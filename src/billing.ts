import Stripe from 'stripe';
import type { Config, Plan } from './config.js';
import { quota } from './config.js';
import { HttpError, type Immich } from './immich.js';
import type { Store, User } from './store.js';

export class Billing {
  readonly stripe: Stripe | undefined;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly cfg: Config, private readonly store: Store, private readonly immich: Immich, client?: Stripe) {
    if (cfg.BILLING_MODE === 'stripe') this.stripe = client ?? new Stripe(cfg.STRIPE_SECRET_KEY);
  }
  // Serialize remote quota changes with their local records so concurrent jobs/webhooks cannot regress plans.
  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.pending.then(fn);
    this.pending = result.catch(() => undefined);
    return result;
  }
  private price(plan: 'basic' | 'pro') { return plan === 'basic' ? this.cfg.STRIPE_PRICE_BASIC : this.cfg.STRIPE_PRICE_PRO; }
  async checkout(account: User, plan: 'basic' | 'pro') {
    const stripe = this.stripe;
    if (!stripe) throw new HttpError(503, 'Online payments are disabled. Contact the operator for a plan change.');
    return this.exclusive(async () => {
      const user = this.store.user(account.id);
      if (!user) throw new HttpError(404, 'Account not found.');
      if (user.subscription) throw new HttpError(409, 'Use Manage billing to change your existing subscription.');
      const pending = this.store.checkout(user.id);
      if (pending?.sessionId) {
        const existing = await stripe.checkout.sessions.retrieve(pending.sessionId);
        if (existing.status === 'open' && existing.url) return existing.url;
        if (existing.status === 'complete') {
          if (typeof existing.subscription === 'string') await this.sync(existing.subscription);
          throw new HttpError(409, 'Payment is being processed. Return to your library shortly.');
        }
        this.store.deleteCheckout(user.id);
      }
      this.store.beginCheckout(user.id, plan);
      const request = this.store.checkout(user.id);
      if (!request) throw new Error('Checkout request was not persisted');
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription', client_reference_id: user.id,
        ...(user.customer ? { customer: user.customer } : { customer_email: user.email }),
        line_items: [{ price: this.price(request.plan), quantity: 1 }],
        subscription_data: { metadata: { sphotoUserId: user.id } },
        success_url: `${this.cfg.PUBLIC_URL}/library?notice=Payment+received.+Your+plan+updates+after+confirmation.`,
        cancel_url: `${this.cfg.PUBLIC_URL}/library?notice=Checkout+cancelled.+Your+plan+has+not+changed.`,
      }, { idempotencyKey: request.requestKey });
      if (!session.url) throw new HttpError(503, 'Checkout could not be opened.');
      this.store.saveCheckout(user.id, session.id);
      return session.url;
    });
  }
  async portal(user: User) {
    if (!this.stripe || !user.customer) throw new HttpError(409, 'There is no billing account for this user.');
    return (await this.stripe.billingPortal.sessions.create({ customer: user.customer, return_url: `${this.cfg.PUBLIC_URL}/library` })).url;
  }
  async manualPlan(id: string, plan: Plan) {
    if (this.stripe) throw new HttpError(409, 'Plan changes are managed by Stripe in this installation.');
    await this.exclusive(async () => {
      const user = this.store.user(id);
      if (!user) throw new HttpError(404, 'Account not found.');
      const remote = await this.immich.adminUser(id);
      if (remote.quotaUsageInBytes > quota(plan)) throw new HttpError(409, 'This library exceeds the new plan. Export or remove photos first.');
      await this.immich.setQuota(id, quota(plan));
      this.store.setPlan(id, plan, null, null);
    });
  }
  private async sync(subscriptionId: string) {
    if (!this.stripe) return;
    // Retrieve current state rather than trusting event arrival order or a checkout redirect.
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata.sphotoUserId;
    if (!userId) return;
    const user = this.store.user(userId);
    if (!user) throw new HttpError(409, 'Subscription account has not been provisioned.');
    if (user.subscription && user.subscription !== subscription.id) return;
    const item = subscription.items.data[0];
    const paid = ['active', 'trialing', 'past_due'].includes(subscription.status);
    let plan: Plan = 'free';
    if (paid) {
      if (subscription.items.data.length !== 1 || item?.quantity !== 1 || item.price.currency !== 'chf' || item.price.recurring?.interval !== 'month' || item.price.recurring.interval_count !== 1 || item.price.unit_amount !== (item.price.id === this.cfg.STRIPE_PRICE_BASIC ? 500 : 1500)) throw new Error('Unsupported subscription configuration');
      if (item.price.id === this.cfg.STRIPE_PRICE_BASIC) plan = 'basic';
      else if (item.price.id === this.cfg.STRIPE_PRICE_PRO) plan = 'pro';
      else throw new Error('Unrecognized subscription price');
    }
    // Reducing a quota preserves existing assets; Immich blocks further uploads when over quota.
    await this.immich.setQuota(user.id, quota(plan));
    const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    this.store.setPlan(user.id, plan, customer, ['canceled', 'incomplete_expired'].includes(subscription.status) ? null : subscription.id);
    this.store.deleteCheckout(user.id);
  }
  async webhook(body: Buffer, signature: string) {
    if (!this.stripe) throw new HttpError(503, 'Stripe is not configured.');
    let event: Stripe.Event;
    try { event = this.stripe.webhooks.constructEvent(body, signature, this.cfg.STRIPE_WEBHOOK_SECRET); }
    catch { throw new HttpError(400, 'Invalid webhook signature.'); }
    await this.exclusive(async () => {
      if (this.store.seenEvent(event.id)) return;
      if (event.type === 'checkout.session.completed') {
        const subscription = event.data.object.subscription;
        if (typeof subscription === 'string') await this.sync(subscription);
      } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.created') {
        await this.sync(event.data.object.id);
      }
      this.store.finishEvent(event.id);
    });
  }
  async reconcile() {
    return this.exclusive(async () => {
      const id = this.store.startJob();
      try {
        this.store.cleanup();
        await this.immich.ping();
        for (const user of this.store.users()) {
          if (user.subscription) await this.sync(user.subscription);
          else await this.immich.setQuota(user.id, quota(user.plan));
        }
        this.store.finishJob(id, null);
      } catch (error) {
        this.store.finishJob(id, 'Storage or billing reconciliation failed. Check service connectivity and configuration.');
        throw error;
      }
    });
  }
}

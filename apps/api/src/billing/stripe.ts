import { paidTierSchema, type PaidTier } from '@sphoto/shared';
import Stripe from 'stripe';
import { z } from 'zod';
import type { Config } from '../config';
import { tierForPriceId } from '../plans';
import { InvalidWebhookError, type Billing, type BillingEvent, type ParsedWebhook } from './billing';

const idOrObject = z.union([z.string(), z.object({ id: z.string() })]).transform((v) => (typeof v === 'string' ? v : v.id));

const checkoutSessionSchema = z.object({
  id: z.string(),
  customer: idOrObject,
  subscription: idOrObject,
  customer_email: z.string().nullish(),
  customer_details: z.object({ email: z.string().nullish() }).nullish(),
  metadata: z.object({ plan: paidTierSchema }),
});

const subscriptionSchema = z.object({
  id: z.string(),
  customer: idOrObject,
  items: z.object({ data: z.array(z.object({ price: z.object({ id: z.string() }) })) }),
});

const invoiceSchema = z.object({ customer: idOrObject, customer_email: z.string().nullish() });

export interface RawStripeEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

// Maps a verified Stripe event to SPhoto's own event type using the payload only, so no
// outbound Stripe call is needed while handling a webhook.
export function mapStripeEvent(config: Config, event: RawStripeEvent): BillingEvent | null {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = checkoutSessionSchema.parse(event.data.object);
      const email = session.customer_details?.email ?? session.customer_email;
      if (!email) throw new Error(`Checkout session ${session.id} has no email`);
      return {
        type: 'checkout.completed',
        sessionId: session.id,
        email: email.trim().toLowerCase(),
        plan: session.metadata.plan,
        customerId: session.customer,
        subscriptionId: session.subscription,
      };
    }
    case 'customer.subscription.updated': {
      const sub = subscriptionSchema.parse(event.data.object);
      const priceId = sub.items.data[0]?.price.id;
      return { type: 'subscription.updated', customerId: sub.customer, plan: priceId ? tierForPriceId(config, priceId) : null };
    }
    case 'customer.subscription.deleted': {
      const sub = subscriptionSchema.parse(event.data.object);
      return { type: 'subscription.canceled', customerId: sub.customer, subscriptionId: sub.id };
    }
    case 'invoice.payment_failed': {
      const invoice = invoiceSchema.parse(event.data.object);
      return { type: 'payment.failed', customerId: invoice.customer, email: invoice.customer_email?.toLowerCase() ?? null };
    }
    default:
      return null;
  }
}

export class StripeBilling implements Billing {
  private readonly stripe: Stripe;

  constructor(private readonly config: Config) {
    const apiUrl = config.env.STRIPE_API_URL ? new URL(config.env.STRIPE_API_URL) : null;
    this.stripe = new Stripe(
      config.env.STRIPE_SECRET_KEY,
      apiUrl
        ? {
            host: apiUrl.hostname,
            port: apiUrl.port,
            protocol: apiUrl.protocol === 'https:' ? 'https' : 'http',
          }
        : {},
    );
  }

  async createCheckout(input: { email: string; plan: PaidTier; successUrl: string; cancelUrl: string }) {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: this.config.stripePrices[input.plan], quantity: 1 }],
      customer_email: input.email,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { plan: input.plan },
    });
    if (!session.url) throw new Error('Stripe returned a checkout session without a URL');
    return { id: session.id, url: session.url };
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    const session = await this.stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    return { url: session.url };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (err) {
      // Already cancelled counts as done.
      if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === 'resource_missing') return;
      throw err;
    }
  }

  async parseWebhook(rawBody: string, signature: string | undefined): Promise<ParsedWebhook> {
    if (!signature) throw new InvalidWebhookError('Missing stripe-signature header');
    let event: Stripe.Event;
    try {
      event = await this.stripe.webhooks.constructEventAsync(rawBody, signature, this.config.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      throw new InvalidWebhookError(err instanceof Error ? err.message : 'Invalid signature');
    }
    return { id: event.id, event: mapStripeEvent(this.config, event) };
  }
}

import { z } from 'zod';
import type { BillingEvent, ParsedWebhook } from '../billing/billing';
import { sendMailSafely, type Ctx } from '../context';
import { addDays } from '../clock';
import { errorMessage } from '../log';
import { templates } from '../mail/templates';
import { gbToBytes, tierName } from '../plans';
import { createAccount } from './accounts';
import { setCheckoutStatus } from './checkout';
import { startMigration } from './migration';

export type WebhookOutcome = 'handled' | 'duplicate' | 'ignored';

export async function handleWebhook(ctx: Ctx, parsed: ParsedWebhook): Promise<WebhookOutcome> {
  const seen = ctx.db.get(z.object({ n: z.number() }), 'SELECT COUNT(*) AS n FROM webhook_events WHERE id = ?', parsed.id);
  if (seen?.n === 1) return 'duplicate';
  if (parsed.event) await handleEvent(ctx, parsed.event);
  // Recorded only after success, so a failed delivery is processed again when the provider retries.
  ctx.db.run('INSERT OR IGNORE INTO webhook_events (id, type, received_at) VALUES (?, ?, ?)', parsed.id, parsed.event?.type ?? 'ignored', ctx.clock().toISOString());
  return parsed.event ? 'handled' : 'ignored';
}

async function handleEvent(ctx: Ctx, event: BillingEvent): Promise<void> {
  switch (event.type) {
    case 'checkout.completed':
      return onCheckoutCompleted(ctx, event);
    case 'subscription.updated':
      return onSubscriptionUpdated(ctx, event);
    case 'subscription.canceled':
      return onSubscriptionCanceled(ctx, event);
    case 'payment.failed':
      return onPaymentFailed(ctx, event);
  }
}

async function alertAdmin(ctx: Ctx, subject: string, text: string): Promise<void> {
  await sendMailSafely(ctx, { to: ctx.config.env.ADMIN_EMAIL, ...templates.adminAlert({ subject, text }) });
}

async function onCheckoutCompleted(ctx: Ctx, event: Extract<BillingEvent, { type: 'checkout.completed' }>): Promise<void> {
  ctx.db.run(
    "INSERT OR IGNORE INTO checkout_sessions (id, email, plan, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
    event.sessionId,
    event.email,
    event.plan,
    ctx.clock().toISOString(),
  );
  setCheckoutStatus(ctx, event.sessionId, 'processing', 'Zahlung erhalten, dein Konto wird eingerichtet');
  const stripeIds = { stripeCustomerId: event.customerId, stripeSubscriptionId: event.subscriptionId };
  const existing = ctx.users.findLiveByEmail(event.email);

  if (!existing) {
    try {
      const { user, password } = await createAccount(ctx, { email: event.email, tier: event.plan, ...stripeIds });
      await sendMailSafely(ctx, {
        to: user.email,
        ...templates.welcome({
          planName: tierName(event.plan),
          quotaGb: user.quotaGb,
          instanceUrl: ctx.config.instances.paid.publicUrl,
          email: user.email,
          password,
          portalUrl: `${ctx.config.publicUrl}/portal`,
        }),
      });
      setCheckoutStatus(ctx, event.sessionId, 'complete', null);
    } catch (err) {
      setCheckoutStatus(ctx, event.sessionId, 'error', 'Dein Konto konnte nicht eingerichtet werden. Wir kümmern uns darum.');
      await alertAdmin(ctx, 'Konto nach Zahlung nicht erstellt', `${event.email}, Stripe-Kunde ${event.customerId}: ${errorMessage(err)}`);
      throw err;
    }
    return;
  }

  if (existing.stripeSubscriptionId === event.subscriptionId) {
    // Redelivered event for a checkout that already ran.
    if (existing.status !== 'migrating') setCheckoutStatus(ctx, event.sessionId, 'complete', null);
    return;
  }

  if (existing.status === 'migrating') {
    throw new Error(`User ${existing.id} is migrating; retry checkout event later`);
  }

  if (existing.tier === 'free') {
    ctx.users.update(existing.id, stripeIds);
    const started = startMigration(ctx, existing.id, event.plan, 'upgrade', (result) => {
      if (result.ok) setCheckoutStatus(ctx, event.sessionId, 'complete', null);
      else setCheckoutStatus(ctx, event.sessionId, 'error', 'Der Umzug deiner Fotos ist fehlgeschlagen. Deine Fotos sind sicher, wir kümmern uns darum.');
    });
    if (!started) throw new Error(`Could not start upgrade for ${existing.id}`);
    setCheckoutStatus(ctx, event.sessionId, 'processing', 'Deine Fotos werden auf den Premium-Server umgezogen');
    return;
  }

  if (existing.cancellationDueAt) {
    // Resubscribed during the grace period: the account never left the paid instance.
    await applyPlan(ctx, existing.id, event.plan);
    ctx.users.update(existing.id, { ...stripeIds, cancellationDueAt: null });
    ctx.notices.clearScope(existing.id, 'cancellation_reminder_');
    setCheckoutStatus(ctx, event.sessionId, 'complete', null);
    return;
  }

  setCheckoutStatus(ctx, event.sessionId, 'error', 'Für diese E-Mail-Adresse gibt es bereits ein Abo.');
  await alertAdmin(
    ctx,
    'Doppelte Zahlung',
    `${event.email} hat ein zweites Abo abgeschlossen (Stripe-Kunde ${event.customerId}, Abo ${event.subscriptionId}). Bitte prüfen und erstatten.`,
  );
}

export async function applyPlan(ctx: Ctx, userId: string, plan: 'basic' | 'pro'): Promise<void> {
  const user = ctx.users.require(userId);
  const quotaGb = ctx.config.quotaGb[plan];
  if (user.immichUserId) await ctx.immich.setQuota(user.instance, user.immichUserId, gbToBytes(quotaGb));
  ctx.users.update(user.id, { tier: plan, quotaGb });
  ctx.usageCache.invalidate(user.instance);
}

async function onSubscriptionUpdated(ctx: Ctx, event: Extract<BillingEvent, { type: 'subscription.updated' }>): Promise<void> {
  const user = ctx.users.findByStripeCustomer(event.customerId);
  if (!user || !event.plan || user.status !== 'active' || user.instance !== 'paid' || user.tier === event.plan) return;
  await applyPlan(ctx, user.id, event.plan);
  await sendMailSafely(ctx, {
    to: user.email,
    ...templates.planChanged({ planName: tierName(event.plan), quotaGb: ctx.config.quotaGb[event.plan] }),
  });
}

async function onSubscriptionCanceled(ctx: Ctx, event: Extract<BillingEvent, { type: 'subscription.canceled' }>): Promise<void> {
  const user = ctx.users.findByStripeCustomer(event.customerId);
  if (!user || user.tier === 'free') return;
  // A newer subscription may already have replaced the one that just ended.
  if (user.stripeSubscriptionId && user.stripeSubscriptionId !== event.subscriptionId) return;
  if (user.cancellationDueAt) return;
  const endsAt = addDays(ctx.clock(), ctx.config.env.CANCELLATION_GRACE_DAYS).toISOString();
  ctx.users.update(user.id, { cancellationDueAt: endsAt, stripeSubscriptionId: null });
  await sendMailSafely(ctx, {
    to: user.email,
    ...templates.cancellationScheduled({ endsAt, freeQuotaGb: ctx.config.quotaGb.free, portalUrl: `${ctx.config.publicUrl}/portal` }),
  });
}

async function onPaymentFailed(ctx: Ctx, event: Extract<BillingEvent, { type: 'payment.failed' }>): Promise<void> {
  const user = ctx.users.findByStripeCustomer(event.customerId);
  if (!user) return;
  await sendMailSafely(ctx, { to: user.email, ...templates.paymentFailed({ portalUrl: `${ctx.config.publicUrl}/portal` }) });
}

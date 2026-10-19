import type { PaidTier } from '@sphoto/shared';

export type BillingEvent =
  | { type: 'checkout.completed'; sessionId: string; email: string; plan: PaidTier; customerId: string; subscriptionId: string }
  | { type: 'subscription.updated'; customerId: string; plan: PaidTier | null }
  | { type: 'subscription.canceled'; customerId: string; subscriptionId: string }
  | { type: 'payment.failed'; customerId: string; email: string | null };

export interface ParsedWebhook {
  /** Provider event id, used to ignore redelivered events. */
  id: string;
  /** Null for event types SPhoto does not act on. */
  event: BillingEvent | null;
}

export class InvalidWebhookError extends Error {}

export interface Billing {
  createCheckout(input: { email: string; plan: PaidTier; successUrl: string; cancelUrl: string }): Promise<{ id: string; url: string }>;
  createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  /** Verifies the signature and maps the provider payload. Throws InvalidWebhookError. */
  parseWebhook(rawBody: string, signature: string | undefined): Promise<ParsedWebhook>;
}

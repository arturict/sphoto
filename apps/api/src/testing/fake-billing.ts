import type { PaidTier } from '@sphoto/shared';
import { InvalidWebhookError, type Billing, type ParsedWebhook } from '../billing/billing';

/** Billing double. `parseWebhook` accepts a JSON-encoded ParsedWebhook when the signature is "valid". */
export class FakeBilling implements Billing {
  readonly checkouts: { id: string; email: string; plan: PaidTier }[] = [];
  readonly cancelledSubscriptions: string[] = [];
  failCancel = false;
  private counter = 0;

  createCheckout(input: { email: string; plan: PaidTier }) {
    const id = `cs_test_${++this.counter}`;
    this.checkouts.push({ id, email: input.email, plan: input.plan });
    return Promise.resolve({ id, url: `https://checkout.example/${id}` });
  }

  createPortalSession(customerId: string) {
    return Promise.resolve({ url: `https://billing.example/${customerId}` });
  }

  cancelSubscription(subscriptionId: string): Promise<void> {
    if (this.failCancel) return Promise.reject(new Error('stripe unavailable'));
    this.cancelledSubscriptions.push(subscriptionId);
    return Promise.resolve();
  }

  parseWebhook(rawBody: string, signature: string | undefined): Promise<ParsedWebhook> {
    if (signature !== 'valid') return Promise.reject(new InvalidWebhookError('bad signature'));
    return Promise.resolve(JSON.parse(rawBody) as ParsedWebhook);
  }
}

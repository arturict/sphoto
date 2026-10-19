import Stripe from 'stripe';
import { env } from './env';

// Signs synthetic Stripe events with the stack's webhook secret, exactly as Stripe would.
const signer = new Stripe('sk_test_signer');

export async function sendStripeEvent(type: string, object: Record<string, unknown>, id = `evt_${crypto.randomUUID()}`): Promise<Response> {
  const payload = JSON.stringify({ id, object: 'event', type, data: { object } });
  const signature = signer.webhooks.generateTestHeaderString({ payload, secret: env.webhookSecret });
  return fetch(`${env.appUrl}/api/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': signature, 'content-type': 'application/json' }, body: payload });
}

export const checkoutCompleted = (input: { sessionId: string; email: string; plan: 'basic' | 'pro'; customer: string; subscription: string }) =>
  sendStripeEvent('checkout.session.completed', {
    id: input.sessionId,
    customer: input.customer,
    subscription: input.subscription,
    customer_details: { email: input.email },
    metadata: { plan: input.plan },
  });

export const subscriptionDeleted = (input: { customer: string; subscription: string }) =>
  sendStripeEvent('customer.subscription.deleted', { id: input.subscription, customer: input.customer, items: { data: [{ price: { id: 'price_e2e_basic' } }] } });

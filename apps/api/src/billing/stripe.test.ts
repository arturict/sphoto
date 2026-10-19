import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { TEST_ENV } from '../testing/harness';
import { InvalidWebhookError } from './billing';
import { mapStripeEvent, StripeBilling } from './stripe';

const config = loadConfig(TEST_ENV);

describe('mapStripeEvent', () => {
  it('maps a completed checkout using only the payload (plan from our own metadata, email from the customer)', () => {
    const event = mapStripeEvent(config, {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          customer: 'cus_1',
          subscription: 'sub_1',
          customer_email: 'typed@example.com',
          customer_details: { email: 'Paid@Example.com' },
          metadata: { plan: 'pro' },
        },
      },
    });
    expect(event).toEqual({ type: 'checkout.completed', sessionId: 'cs_1', email: 'paid@example.com', plan: 'pro', customerId: 'cus_1', subscriptionId: 'sub_1' });
  });

  it('accepts expanded customer and subscription objects', () => {
    const event = mapStripeEvent(config, {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_1', customer: { id: 'cus_1' }, subscription: { id: 'sub_1' }, customer_email: 'a@example.com', metadata: { plan: 'basic' } } },
    });
    expect(event).toMatchObject({ customerId: 'cus_1', subscriptionId: 'sub_1' });
  });

  it('rejects a checkout whose plan metadata is not one of ours', () => {
    expect(() =>
      mapStripeEvent(config, { id: 'e', type: 'checkout.session.completed', data: { object: { id: 'cs', customer: 'c', subscription: 's', customer_email: 'a@b.ch', metadata: { plan: 'enterprise' } } } }),
    ).toThrow();
  });

  it('maps price ids to tiers on subscription updates and tolerates unknown prices', () => {
    const update = (priceId: string) =>
      mapStripeEvent(config, { id: 'e', type: 'customer.subscription.updated', data: { object: { id: 'sub_1', customer: 'cus_1', items: { data: [{ price: { id: priceId } }] } } } });
    expect(update('price_pro')).toEqual({ type: 'subscription.updated', customerId: 'cus_1', plan: 'pro' });
    expect(update('price_other')).toEqual({ type: 'subscription.updated', customerId: 'cus_1', plan: null });
  });

  it('maps cancellations, failed payments and ignores everything else', () => {
    expect(mapStripeEvent(config, { id: 'e', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1', items: { data: [] } } } })).toEqual({
      type: 'subscription.canceled',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
    });
    expect(mapStripeEvent(config, { id: 'e', type: 'invoice.payment_failed', data: { object: { customer: 'cus_1', customer_email: 'A@b.ch' } } })).toEqual({
      type: 'payment.failed',
      customerId: 'cus_1',
      email: 'a@b.ch',
    });
    expect(mapStripeEvent(config, { id: 'e', type: 'charge.refunded', data: { object: {} } })).toBeNull();
  });
});

describe('StripeBilling.parseWebhook', () => {
  const billing = new StripeBilling(config);
  const payload = JSON.stringify({
    id: 'evt_sig',
    object: 'event',
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_1', customer: 'cus_1', items: { data: [] } } },
  });
  const sign = (body: string, secret: string) =>
    new Stripe('sk_test_x').webhooks.generateTestHeaderString({ payload: body, secret });

  it('accepts a correctly signed payload', async () => {
    const parsed = await billing.parseWebhook(payload, sign(payload, config.env.STRIPE_WEBHOOK_SECRET));
    expect(parsed).toEqual({ id: 'evt_sig', event: { type: 'subscription.canceled', customerId: 'cus_1', subscriptionId: 'sub_1' } });
  });

  it('rejects a wrong secret, a tampered body and a missing header', async () => {
    await expect(billing.parseWebhook(payload, sign(payload, 'whsec_other'))).rejects.toBeInstanceOf(InvalidWebhookError);
    await expect(billing.parseWebhook(payload.replace('sub_1', 'sub_2'), sign(payload, config.env.STRIPE_WEBHOOK_SECRET))).rejects.toBeInstanceOf(InvalidWebhookError);
    await expect(billing.parseWebhook(payload, undefined)).rejects.toBeInstanceOf(InvalidWebhookError);
  });
});

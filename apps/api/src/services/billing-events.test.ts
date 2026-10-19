import { beforeEach, describe, expect, it } from 'vitest';
import type { BillingEvent } from '../billing/billing';
import { startCheckout, checkoutStatus } from './checkout';
import { handleWebhook } from './billing-events';
import { freeSignup } from './signup';
import { createHarness, DAY, type Harness } from '../testing/harness';

let h: Harness;
beforeEach(() => {
  h = createHarness();
});

let eventCounter = 0;
const deliver = (event: BillingEvent, id = `evt_${++eventCounter}`) => handleWebhook(h.ctx, { id, event });
const completed = (email: string, plan: 'basic' | 'pro' = 'basic', n = 1): Extract<BillingEvent, { type: 'checkout.completed' }> => ({
  type: 'checkout.completed',
  sessionId: `cs_${email}_${n}`,
  email,
  plan,
  customerId: `cus_${email}`,
  subscriptionId: `sub_${email}_${n}`,
});

describe('checkout.completed for a new customer', () => {
  it('creates a paid account on the paid instance, stores the Stripe ids and welcomes the customer', async () => {
    const { url } = await startCheckout(h.ctx, { email: 'bea@example.com', plan: 'basic' });
    expect(url).toContain('checkout.example');
    const sessionId = h.billing.checkouts[0]?.id ?? '';
    expect(checkoutStatus(h.ctx, sessionId).status).toBe('pending');

    await deliver({ ...completed('bea@example.com'), sessionId });

    const user = h.ctx.users.findLiveByEmail('bea@example.com');
    expect(user).toMatchObject({ tier: 'basic', instance: 'paid', quotaGb: 10, stripeCustomerId: 'cus_bea@example.com' });
    expect(h.immich.quotaOf('paid', 'bea@example.com')).toBe(10 * 1024 ** 3);
    expect(h.mailer.to('bea@example.com')[0]?.subject).toContain('Willkommen');
    expect(checkoutStatus(h.ctx, sessionId)).toMatchObject({ status: 'complete', instanceUrl: 'https://photos.sphoto.test' });
  });

  it('ignores a redelivered event and an event it already finished', async () => {
    await deliver(completed('bea@example.com'), 'evt_same');
    expect(await handleWebhook(h.ctx, { id: 'evt_same', event: completed('bea@example.com') })).toBe('duplicate');
    // Same checkout under a new event id (Stripe replay): still one account.
    await deliver(completed('bea@example.com'));
    expect(h.immich.userCount('paid')).toBe(1);
    expect(h.mailer.to('bea@example.com')).toHaveLength(1);
  });

  it('lets Stripe retry when the account could not be created, and tells the admin', async () => {
    h.immich.failCreateUser.add('paid');
    await expect(deliver(completed('bea@example.com'), 'evt_retry')).rejects.toThrow();
    expect(h.mailer.to('admin@sphoto.test')[0]?.subject).toContain('Konto nach Zahlung nicht erstellt');
    expect(checkoutStatus(h.ctx, 'cs_bea@example.com_1').status).toBe('error');

    h.immich.failCreateUser.clear();
    await expect(deliver(completed('bea@example.com'), 'evt_retry')).resolves.toBe('handled');
    expect(h.ctx.users.findLiveByEmail('bea@example.com')?.tier).toBe('basic');
  });

  it('refuses to start a checkout for an address that already has a subscription', async () => {
    await deliver(completed('bea@example.com'));
    await expect(startCheckout(h.ctx, { email: 'bea@example.com', plan: 'pro' })).rejects.toMatchObject({ status: 409 });
  });

  it('flags a second subscription on the same address instead of creating a duplicate', async () => {
    await deliver(completed('bea@example.com', 'basic', 1));
    await deliver(completed('bea@example.com', 'pro', 2));
    expect(h.immich.userCount('paid')).toBe(1);
    expect(h.mailer.to('admin@sphoto.test').some((m) => m.subject.includes('Doppelte Zahlung'))).toBe(true);
    expect(checkoutStatus(h.ctx, 'cs_bea@example.com_2').status).toBe('error');
  });
});

describe('upgrade from free', () => {
  beforeEach(async () => {
    await freeSignup(h.ctx, { email: 'carl@example.com', clientKey: 'c' });
    const a = h.immich.seedAsset('free', 'carl@example.com', { filename: 'a.jpg', content: 'AAAA', isFavorite: true });
    const b = h.immich.seedAsset('free', 'carl@example.com', { filename: 'b.jpg', content: 'BBBB', visibility: 'archive' });
    const video = h.immich.seedAsset('free', 'carl@example.com', { filename: 'live.mov', content: 'MOTION', visibility: 'hidden' });
    h.immich.seedAsset('free', 'carl@example.com', { filename: 'live.heic', content: 'STILL', livePhotoVideoId: video });
    h.immich.seedAlbum('free', 'carl@example.com', 'Ferien', [a, b]);
    h.mailer.sent.length = 0;
  });

  it('moves photos, metadata and albums to the paid instance and removes the free account', async () => {
    const oldPassword = h.immich.findUser('free', 'carl@example.com')?.password;
    await deliver(completed('carl@example.com', 'pro'));
    await h.ctx.background.idle();

    const user = h.ctx.users.findLiveByEmail('carl@example.com');
    expect(user).toMatchObject({ tier: 'pro', instance: 'paid', status: 'active', quotaGb: 50 });
    expect(h.immich.userCount('free')).toBe(0);

    const moved = h.immich.assetsFor('paid', 'carl@example.com');
    expect(moved.map((a) => a.filename).sort()).toEqual(['a.jpg', 'b.jpg', 'live.heic', 'live.mov']);
    expect(moved.find((a) => a.filename === 'a.jpg')?.isFavorite).toBe(true);
    expect(moved.find((a) => a.filename === 'b.jpg')?.visibility).toBe('archive');
    const motion = moved.find((a) => a.filename === 'live.mov');
    expect(moved.find((a) => a.filename === 'live.heic')?.livePhotoVideoId).toBe(motion?.id);
    expect(h.immich.albumsFor('paid', 'carl@example.com').map((a) => [a.name, a.filenames])).toEqual([['Ferien', ['a.jpg', 'b.jpg']]]);

    const mail = h.mailer.to('carl@example.com').find((m) => m.subject.includes('Upgrade'));
    const newPassword = mail?.text.match(/Neues Passwort: (\S+)/)?.[1];
    expect(newPassword).toBeTruthy();
    expect(newPassword).not.toBe(oldPassword);
    expect(newPassword).toBe(h.immich.findUser('paid', 'carl@example.com')?.password);
    expect(checkoutStatus(h.ctx, 'cs_carl@example.com_1').status).toBe('complete');
    expect(h.ctx.jobs.latestForUser(user?.id ?? '')).toMatchObject({ kind: 'upgrade', status: 'succeeded', done: 4, total: 4 });
  });

  it('keeps the free account untouched when a file cannot be copied, then succeeds on retry', async () => {
    h.immich.failUploads.add('b.jpg');
    await deliver(completed('carl@example.com', 'pro'));
    await h.ctx.background.idle();

    const user = h.ctx.users.findLiveByEmail('carl@example.com');
    expect(user).toMatchObject({ tier: 'free', instance: 'free', status: 'active', stripeSubscriptionId: 'sub_carl@example.com_1' });
    expect(h.immich.assetsFor('free', 'carl@example.com')).toHaveLength(4);
    expect(h.immich.userCount('paid')).toBe(0);
    expect(h.ctx.jobs.latestForUser(user?.id ?? '')).toMatchObject({ status: 'failed' });
    expect(checkoutStatus(h.ctx, 'cs_carl@example.com_1').status).toBe('error');
    expect(h.mailer.to('admin@sphoto.test').some((m) => m.subject.includes('Migration fehlgeschlagen'))).toBe(true);

    h.immich.failUploads.clear();
    const { setTier } = await import('./admin');
    await setTier(h.ctx, user?.id ?? '', 'pro');
    await h.ctx.background.idle();
    expect(h.ctx.users.get(user?.id ?? '')).toMatchObject({ tier: 'pro', instance: 'paid' });
    expect(h.immich.assetsFor('paid', 'carl@example.com')).toHaveLength(4);
  });
});

describe('subscription lifecycle', () => {
  beforeEach(async () => {
    await deliver(completed('bea@example.com', 'basic'));
    h.mailer.sent.length = 0;
  });

  it('changes quota when the plan changes in Stripe', async () => {
    await deliver({ type: 'subscription.updated', customerId: 'cus_bea@example.com', plan: 'pro' });
    expect(h.ctx.users.findLiveByEmail('bea@example.com')).toMatchObject({ tier: 'pro', quotaGb: 50 });
    expect(h.immich.quotaOf('paid', 'bea@example.com')).toBe(50 * 1024 ** 3);
    expect(h.mailer.to('bea@example.com')[0]?.subject).toContain('Pro');
  });

  it('starts a grace period when the subscription ends, without touching photos', async () => {
    h.immich.seedAsset('paid', 'bea@example.com', { filename: 'keep.jpg', content: 'KEEP' });
    await deliver({ type: 'subscription.canceled', customerId: 'cus_bea@example.com', subscriptionId: 'sub_bea@example.com_1' });

    const user = h.ctx.users.findLiveByEmail('bea@example.com');
    expect(new Date(user?.cancellationDueAt ?? '').getTime()).toBe(h.now().getTime() + 14 * DAY);
    expect(user).toMatchObject({ tier: 'basic', instance: 'paid', stripeSubscriptionId: null });
    expect(h.immich.assetsFor('paid', 'bea@example.com')).toHaveLength(1);
    expect(h.mailer.to('bea@example.com')[0]?.subject).toContain('Abo');
  });

  it('ignores the end of an older subscription after the customer subscribed again', async () => {
    await deliver({ type: 'subscription.canceled', customerId: 'cus_bea@example.com', subscriptionId: 'sub_old' });
    expect(h.ctx.users.findLiveByEmail('bea@example.com')?.cancellationDueAt).toBeNull();
  });

  it('ends the grace period when the customer subscribes again', async () => {
    await deliver({ type: 'subscription.canceled', customerId: 'cus_bea@example.com', subscriptionId: 'sub_bea@example.com_1' });
    h.advance(3 * DAY);
    await deliver(completed('bea@example.com', 'pro', 2));

    const user = h.ctx.users.findLiveByEmail('bea@example.com');
    expect(user).toMatchObject({ tier: 'pro', cancellationDueAt: null, stripeSubscriptionId: 'sub_bea@example.com_2', instance: 'paid' });
    expect(h.immich.userCount('paid')).toBe(1);
    expect(h.immich.quotaOf('paid', 'bea@example.com')).toBe(50 * 1024 ** 3);
  });

  it('mails the customer when a payment fails', async () => {
    await deliver({ type: 'payment.failed', customerId: 'cus_bea@example.com', email: 'bea@example.com' });
    expect(h.mailer.to('bea@example.com')[0]?.subject).toContain('Zahlung');
  });
});

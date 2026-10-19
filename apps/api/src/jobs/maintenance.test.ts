import { beforeEach, describe, expect, it } from 'vitest';
import { handleWebhook } from '../services/billing-events';
import { cancelDeletion, requestDeletion } from '../services/portal';
import { freeSignup } from '../services/signup';
import { createHarness, DAY, must, type Harness } from '../testing/harness';
import { runMaintenance } from './maintenance';

let h: Harness;
beforeEach(() => {
  h = createHarness();
});

const paidUser = async (email: string, subscription = `sub_${email}`) => {
  await handleWebhook(h.ctx, {
    id: `evt_${email}`,
    event: { type: 'checkout.completed', sessionId: `cs_${email}`, email, plan: 'basic', customerId: `cus_${email}`, subscriptionId: subscription },
  });
  return must(h.ctx.users.findLiveByEmail(email));
};
const cancel = (email: string) =>
  handleWebhook(h.ctx, { id: `evt_cancel_${email}`, event: { type: 'subscription.canceled', customerId: `cus_${email}`, subscriptionId: `sub_${email}` } });

describe('scheduled account deletion', () => {
  it('deletes only after the grace period, cancels the subscription and anonymises the record', async () => {
    const user = await paidUser('dora@example.com');
    h.immich.seedAsset('paid', 'dora@example.com', { filename: 'x.jpg', content: 'X' });
    await requestDeletion(h.ctx, user);

    h.advance(13 * DAY);
    await runMaintenance(h.ctx);
    expect(h.ctx.users.get(user.id)?.status).toBe('active');
    expect(h.immich.userCount('paid')).toBe(1);

    h.advance(2 * DAY);
    await runMaintenance(h.ctx);
    const after = h.ctx.users.get(user.id);
    expect(after).toMatchObject({ status: 'deleted', immichApiKey: null, immichUserId: null });
    expect(after?.email).not.toContain('dora');
    expect(h.immich.userCount('paid')).toBe(0);
    expect(h.billing.cancelledSubscriptions).toEqual(['sub_dora@example.com']);
    expect(h.mailer.to('dora@example.com').some((m) => m.subject.includes('gelöscht'))).toBe(true);
    // The address can be used for a new account.
    await expect(freeSignup(h.ctx, { email: 'dora@example.com', clientKey: 'd' })).resolves.toBeDefined();
  });

  it('can be cancelled during the grace period', async () => {
    const user = await paidUser('dora@example.com');
    await requestDeletion(h.ctx, user);
    await cancelDeletion(h.ctx, h.ctx.users.require(user.id));
    h.advance(30 * DAY);
    await runMaintenance(h.ctx);
    expect(h.ctx.users.get(user.id)?.status).toBe('active');
  });

  it('retries later when Stripe cannot cancel the subscription, deleting nothing in the meantime', async () => {
    const user = await paidUser('dora@example.com');
    await requestDeletion(h.ctx, user);
    h.advance(15 * DAY);
    h.billing.failCancel = true;
    await runMaintenance(h.ctx);
    expect(h.ctx.users.get(user.id)?.status).toBe('active');
    expect(h.immich.userCount('paid')).toBe(1);

    h.billing.failCancel = false;
    await runMaintenance(h.ctx);
    expect(h.ctx.users.get(user.id)?.status).toBe('deleted');
  });
});

describe('cancellation grace period', () => {
  it('mails one reminder per threshold, then moves the account to the free instance', async () => {
    const user = await paidUser('eli@example.com');
    h.immich.seedAsset('paid', 'eli@example.com', { filename: 'small.jpg', content: 'SMALL' });
    await cancel('eli@example.com');
    h.mailer.sent.length = 0;

    h.advance(8 * DAY); // 6 days left
    await runMaintenance(h.ctx);
    await runMaintenance(h.ctx);
    expect(h.mailer.to('eli@example.com').filter((m) => m.subject.includes('Tage bis')).length).toBe(1);

    h.advance(4 * DAY); // 2 days left
    await runMaintenance(h.ctx);
    expect(h.mailer.to('eli@example.com').filter((m) => m.subject.includes('Tage bis')).length).toBe(2);

    h.advance(3 * DAY); // due
    await runMaintenance(h.ctx);
    await h.ctx.background.idle();
    expect(h.ctx.users.get(user.id)).toMatchObject({ tier: 'free', instance: 'free', cancellationDueAt: null, quotaGb: 1 });
    expect(h.immich.assetsFor('free', 'eli@example.com').map((a) => a.filename)).toEqual(['small.jpg']);
    expect(h.immich.userCount('paid')).toBe(0);
  });

  it('does not delete anything when the library no longer fits the free plan', async () => {
    const user = await paidUser('fay@example.com');
    h.immich.seedAsset('paid', 'fay@example.com', { filename: 'big.mp4', content: 'x'.repeat(10) });
    // Free quota is 1 GB in tests; make the library look bigger than that.
    const original = h.immich.usage.bind(h.immich);
    h.immich.usage = async (instance) => (await original(instance)).map((u) => ({ ...u, usageBytes: 2 * 1024 ** 3 }));
    await cancel('fay@example.com');
    h.advance(15 * DAY);
    h.mailer.sent.length = 0;

    await runMaintenance(h.ctx);
    await runMaintenance(h.ctx);
    expect(h.ctx.users.get(user.id)).toMatchObject({ tier: 'basic', instance: 'paid' });
    expect(h.immich.assetsFor('paid', 'fay@example.com')).toHaveLength(1);
    // The customer and the admin are told exactly once.
    expect(h.mailer.to('fay@example.com').filter((m) => m.subject.includes('Free-Plan')).length).toBe(1);
    expect(h.mailer.to('admin@sphoto.test').filter((m) => m.subject.includes('Downgrade blockiert')).length).toBe(1);
  });

  it('skips the downgrade for an account that is about to be deleted', async () => {
    const user = await paidUser('gus@example.com');
    await cancel('gus@example.com');
    await requestDeletion(h.ctx, h.ctx.users.require(user.id));
    h.advance(15 * DAY);
    await runMaintenance(h.ctx);
    await h.ctx.background.idle();
    expect(h.ctx.users.get(user.id)?.status).toBe('deleted');
    expect(h.immich.userCount('free')).toBe(0);
  });
});

describe('usage monitoring', () => {
  it('records one snapshot per user and day and warns once per threshold', async () => {
    await freeSignup(h.ctx, { email: 'hana@example.com', clientKey: 'h' });
    h.mailer.sent.length = 0;
    const user = must(h.ctx.users.findLiveByEmail('hana@example.com'));
    const original = h.immich.usage.bind(h.immich);
    let bytes = 0.85 * 1024 ** 3;
    h.immich.usage = async (instance) => (await original(instance)).map((u) => ({ ...u, usageBytes: bytes }));

    await runMaintenance(h.ctx);
    await runMaintenance(h.ctx);
    expect(h.mailer.to('hana@example.com').filter((m) => m.subject.includes('80 %'))).toHaveLength(1);
    expect(h.ctx.db.raw.prepare('SELECT COUNT(*) AS n FROM usage_snapshots WHERE user_id = ?').get(user.id)).toEqual({ n: 1 });

    bytes = 0.97 * 1024 ** 3;
    await runMaintenance(h.ctx);
    expect(h.mailer.to('hana@example.com').filter((m) => m.subject.includes('95 %'))).toHaveLength(1);

    bytes = 0.1 * 1024 ** 3;
    await runMaintenance(h.ctx);
    bytes = 0.85 * 1024 ** 3;
    await runMaintenance(h.ctx);
    expect(h.mailer.to('hana@example.com').filter((m) => m.subject.includes('80 %'))).toHaveLength(2);
  });
});

describe('health checks', () => {
  it('alerts the admin after two failures, only once, and reports recovery', async () => {
    h.immich.downInstances.add('paid');
    await runMaintenance(h.ctx);
    expect(h.mailer.to('admin@sphoto.test')).toHaveLength(0);
    await runMaintenance(h.ctx);
    await runMaintenance(h.ctx);
    const down = h.mailer.to('admin@sphoto.test').filter((m) => m.subject.includes('nicht erreichbar'));
    expect(down).toHaveLength(1);

    h.immich.downInstances.clear();
    await runMaintenance(h.ctx);
    expect(h.mailer.to('admin@sphoto.test').some((m) => m.subject.includes('wieder erreichbar'))).toBe(true);
  });

  it('keeps running the other tasks when one task fails', async () => {
    h.immich.downInstances.add('free');
    h.immich.downInstances.add('paid');
    const report = await runMaintenance(h.ctx);
    expect(report.tasks.find((t) => t.task === 'usage')?.ok).toBe(false);
    expect(report.tasks.find((t) => t.task === 'health')?.ok).toBe(true);
    expect(report.tasks.find((t) => t.task === 'cleanup')?.ok).toBe(true);
  });
});

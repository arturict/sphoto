import { beforeEach, describe, expect, it } from 'vitest';
import type { ParsedWebhook } from '../billing/billing';
import { createHarness, TEST_ENV, type Harness } from '../testing/harness';
import { createApp } from './app';

let h: Harness;
let app: ReturnType<typeof createApp>;
beforeEach(() => {
  h = createHarness();
  app = createApp(h.ctx);
});

const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const adminHeaders = { authorization: `Bearer ${TEST_ENV['ADMIN_API_KEY']}` };

async function loginAs(email: string): Promise<string> {
  await app.request('/api/portal/login', json({ email }));
  const token = h.mailer.to(email).at(-1)?.text.match(/token=([\w-]+)/)?.[1];
  const res = await app.request('/api/portal/session', json({ token }, { origin: 'https://sphoto.test' }));
  expect(res.status).toBe(200);
  const cookie = res.headers.get('set-cookie') ?? '';
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');
  expect(cookie).toContain('SameSite=Lax');
  return cookie.split(';')[0] ?? '';
}

describe('public endpoints', () => {
  it('describes plans and instance addresses', async () => {
    const res = await app.request('/api/config');
    const body = (await res.json()) as { plans: { id: string; storageGb: number; priceChfPerMonth: number }[] };
    expect(body.plans.map((p) => [p.id, p.storageGb, p.priceChfPerMonth])).toEqual([
      ['free', 1, 0],
      ['basic', 10, 5],
      ['pro', 50, 15],
    ]);
  });

  it('signs up a free user and validates the email', async () => {
    const bad = await app.request('/api/signup/free', json({ email: 'not-an-email' }));
    expect(bad.status).toBe(400);
    const ok = await app.request('/api/signup/free', json({ email: 'Anna@Example.com ' }));
    expect(ok.status).toBe(201);
    expect(h.ctx.users.findLiveByEmail('anna@example.com')).toBeDefined();
    const again = await app.request('/api/signup/free', json({ email: 'anna@example.com' }));
    expect(again.status).toBe(409);
  });

  it('reports ready only after both Immich instances finished their setup', async () => {
    expect((await app.request('/api/ready')).status).toBe(503);
    h.ctx.readiness.free = 'ready';
    expect((await app.request('/api/ready')).status).toBe(503);
    h.ctx.readiness.paid = 'ready';
    expect(await (await app.request('/api/ready')).json()).toMatchObject({ ready: true });
  });

  it('answers 503 with a clear message when the photo server is unreachable', async () => {
    h.immich.downInstances.add('free');
    const res = await app.request('/api/signup/free', json({ email: 'anna@example.com' }));
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toContain('Foto-Server');
    expect(h.ctx.users.findLiveByEmail('anna@example.com')).toBeUndefined();
  });

  it('returns JSON errors for unknown API routes', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Nicht gefunden' });
  });
});

describe('abuse limits', () => {
  it('limits login mails and checkouts per client across addresses', async () => {
    const asClient = (body: unknown) => json(body, { 'x-forwarded-for': '203.0.113.7' });
    for (let i = 0; i < 30; i++) expect((await app.request('/api/portal/login', asClient({ email: `u${i}@example.com` }))).status).toBe(202);
    expect((await app.request('/api/portal/login', asClient({ email: 'u31@example.com' }))).status).toBe(429);
    expect((await app.request('/api/portal/login', json({ email: 'u31@example.com' }, { 'x-forwarded-for': '203.0.113.8' }))).status).toBe(202);
  });
});

describe('stripe webhook', () => {
  const event: ParsedWebhook = {
    id: 'evt_http',
    event: { type: 'checkout.completed', sessionId: 'cs_http', email: 'bea@example.com', plan: 'basic', customerId: 'cus_1', subscriptionId: 'sub_1' },
  };

  it('rejects an invalid signature without side effects', async () => {
    const res = await app.request('/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 'forged' }, body: JSON.stringify(event) });
    expect(res.status).toBe(400);
    expect(h.immich.userCount('paid')).toBe(0);
  });

  it('creates the paid account once, even when delivered twice', async () => {
    const send = () => app.request('/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': 'valid' }, body: JSON.stringify(event) });
    expect(await (await send()).json()).toMatchObject({ outcome: 'handled' });
    expect(await (await send()).json()).toMatchObject({ outcome: 'duplicate' });
    expect(h.immich.userCount('paid')).toBe(1);
    const status = await app.request('/api/checkout/cs_http');
    expect(await status.json()).toMatchObject({ status: 'complete' });
  });
});

describe('portal', () => {
  beforeEach(async () => {
    await app.request('/api/signup/free', json({ email: 'anna@example.com' }));
    h.immich.seedAsset('free', 'anna@example.com', { filename: 'a.jpg', content: 'AAAA' });
  });

  it('requires a session', async () => {
    expect((await app.request('/api/portal/me')).status).toBe(401);
    expect((await app.request('/api/portal/export', json({}))).status).toBe(401);
  });

  it('shows the account after login and ends the session on logout', async () => {
    const cookie = await loginAs('anna@example.com');
    const me = (await (await app.request('/api/portal/me', { headers: { cookie } })).json()) as Record<string, unknown>;
    expect(me).toMatchObject({ email: 'anna@example.com', tier: 'free', planName: 'Free', quotaGb: 1, usedBytes: 4, photos: 1, canUpgrade: true, hasMl: false });

    const out = await app.request('/api/portal/logout', json({}, { cookie, origin: 'https://sphoto.test' }));
    expect(out.status).toBe(200);
    expect((await app.request('/api/portal/me', { headers: { cookie } })).status).toBe(401);
  });

  it('refuses state-changing requests that come from another origin', async () => {
    const cookie = await loginAs('anna@example.com');
    const res = await app.request('/api/portal/delete-account', json({}, { cookie, origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(h.ctx.users.findLiveByEmail('anna@example.com')?.deletionDueAt).toBeNull();
  });

  it('shows usage as unknown instead of failing when the photo server is down', async () => {
    const cookie = await loginAs('anna@example.com');
    h.immich.downInstances.add('free');
    const me = (await (await app.request('/api/portal/me', { headers: { cookie } })).json()) as Record<string, unknown>;
    expect(me).toMatchObject({ usedBytes: null, photos: null });
  });

  it('schedules and cancels deletion and starts an upgrade checkout', async () => {
    const cookie = await loginAs('anna@example.com');
    const headers = { cookie, origin: 'https://sphoto.test' };
    const del = (await (await app.request('/api/portal/delete-account', json({}, headers))).json()) as { deletionDueAt: string };
    expect(new Date(del.deletionDueAt).getTime()).toBe(h.now().getTime() + 14 * 86_400_000);
    await app.request('/api/portal/cancel-deletion', json({}, headers));
    expect(h.ctx.users.findLiveByEmail('anna@example.com')?.deletionDueAt).toBeNull();

    const upgrade = await app.request('/api/portal/upgrade', json({ plan: 'pro' }, headers));
    expect(await upgrade.json()).toEqual({ url: 'https://checkout.example/cs_test_1' });
    expect(h.billing.checkouts[0]).toMatchObject({ email: 'anna@example.com', plan: 'pro' });
    const billing = await app.request('/api/portal/billing', json({}, headers));
    expect(billing.status).toBe(409);
  });

  it('serves an export only to the logged-in owner', async () => {
    const cookie = await loginAs('anna@example.com');
    const headers = { cookie, origin: 'https://sphoto.test' };
    expect((await app.request('/api/portal/export', json({}, headers))).status).toBe(202);
    await h.ctx.background.idle();
    const me = (await (await app.request('/api/portal/me', { headers: { cookie } })).json()) as { latestExport: { id: string } };
    const url = `/api/portal/export/${me.latestExport.id}/parts/0`;

    const file = await app.request(url, { headers: { cookie } });
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('application/zip');
    expect(await file.text()).toBe('ZIP[a.jpg]');
    expect((await app.request(url)).status).toBe(401);

    await app.request('/api/signup/free', json({ email: 'ben@example.com' }));
    const otherCookie = await loginAs('ben@example.com');
    expect((await app.request(url, { headers: { cookie: otherCookie } })).status).toBe(404);
  });
});

describe('admin', () => {
  beforeEach(async () => {
    await app.request('/api/signup/free', json({ email: 'anna@example.com' }));
  });

  it('rejects missing and wrong keys', async () => {
    expect((await app.request('/api/admin/users')).status).toBe(401);
    expect((await app.request('/api/admin/users', { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
  });

  it('lists users, shows the overview and runs maintenance on demand', async () => {
    const users = (await (await app.request('/api/admin/users', { headers: adminHeaders })).json()) as { email: string; usedBytes: number | null }[];
    expect(users.map((u) => u.email)).toEqual(['anna@example.com']);

    const overview = (await (await app.request('/api/admin/overview', { headers: adminHeaders })).json()) as { users: { free: number }; instances: unknown[] };
    expect(overview.users.free).toBe(1);
    expect(overview.instances).toHaveLength(2);

    const run = (await (await app.request('/api/admin/jobs/run', { method: 'POST', headers: adminHeaders })).json()) as { tasks: { ok: boolean }[] };
    expect(run.tasks.every((t) => t.ok)).toBe(true);
  });

  it('deletes a user only when the email is confirmed', async () => {
    const id = h.ctx.users.findLiveByEmail('anna@example.com')?.id ?? '';
    const wrong = await app.request(`/api/admin/users/${id}`, { ...json({ confirmEmail: 'other@example.com' }, adminHeaders), method: 'DELETE' });
    expect(wrong.status).toBe(400);
    expect(h.immich.userCount('free')).toBe(1);
    const ok = await app.request(`/api/admin/users/${id}`, { ...json({ confirmEmail: 'anna@example.com' }, adminHeaders), method: 'DELETE' });
    expect(ok.status).toBe(200);
    expect(h.immich.userCount('free')).toBe(0);
  });
});

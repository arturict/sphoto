import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.js';
import { quota } from '../src/config.js';

const onePixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');

test('signup, escaped empty library, login/logout, duplicate email and bad credentials', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const cookie = await f.signUp('first@example.test');
  const library = await f.request('/library', { headers: { cookie } });
  assert.equal(library.status, 200);
  const html = await library.text();
  assert.match(html, /No photos here yet/);
  assert.match(html, /&lt;Test User&gt;/);
  assert.doesNotMatch(html, /<Test User>/);
  assert.match(cookie, /sphoto_session=/);
  const duplicate = await f.post('/signup', { email: 'first@example.test', name: 'Other', password: 'synthetic customer password' });
  assert.equal(duplicate.status, 400);
  assert.equal((await f.post('/login', { email: 'first@example.test', password: 'wrong' })).status, 401);
  assert.equal((await f.post('/logout', {}, cookie)).status, 303);
  assert.equal((await f.request('/library', { headers: { cookie } })).status, 401);
  const login = await f.post('/login', { email: 'first@example.test', password: 'synthetic customer password' });
  assert.equal(login.status, 303);
  assert.match(login.headers.get('set-cookie') ?? '', /HttpOnly/);
  assert.match(login.headers.get('set-cookie') ?? '', /SameSite=Strict/);
});

test('origin checks, invalid signup, protected routes and admin authorization', async t => {
  const f = await fixture(); t.after(f.cleanup);
  assert.equal((await f.request('/signup', { method: 'POST', body: new URLSearchParams({}) })).status, 403);
  assert.equal((await f.request('/login', { method: 'POST', headers: { origin: 'https://attacker.test' } })).status, 403);
  assert.equal((await f.post('/signup', { email: 'bad', name: '', password: 'short' })).status, 400);
  assert.equal((await f.request('/admin')).status, 401);
  const cookie = await f.signUp('member@example.test');
  assert.equal((await f.request('/admin', { headers: { cookie } })).status, 403);
  assert.equal((await f.post('/admin/reconcile', {}, cookie)).status, 403);
  assert.equal((await f.request('/photos/not-an-id/original', { headers: { cookie } })).status, 400);
  assert.equal((await f.request('/missing')).status, 404);
});

test('upload, browse, original downloads and cross-customer isolation use real HTTP adapters', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const alice = await f.signUp('alice@example.test');
  const bob = await f.signUp('bob@example.test');
  const data = new FormData(); data.set('photo', new Blob([onePixel], { type: 'image/png' }), 'fixture.png');
  const uploaded = await f.request('/upload', { method: 'POST', headers: { cookie: alice, origin: f.cfg.PUBLIC_URL }, body: data });
  assert.equal(uploaded.status, 303);
  const asset = [...f.assets.values()][0]; assert.ok(asset);
  assert.match(await (await f.request('/library', { headers: { cookie: alice } })).text(), /test.png/);
  assert.doesNotMatch(await (await f.request('/library', { headers: { cookie: bob } })).text(), /test.png/);
  assert.equal((await f.request(`/photos/${asset.id}/original`, { headers: { cookie: alice } })).status, 200);
  assert.equal((await f.request(`/photos/${asset.id}/original`, { headers: { cookie: bob } })).status, 404);
  assert.equal((await f.request(`/photos/${asset.id}/thumbnail`)).status, 401);
  const noFile = await f.post('/upload', {}, alice);
  assert.equal(noFile.status, 400);
  const user = [...f.accounts.values()].find(a => a.email === 'alice@example.test'); assert.ok(user);
  user.quotaUsageInBytes = quota('free');
  const full = new FormData(); full.set('photo', new Blob([onePixel], { type: 'image/png' }), 'fixture.png');
  assert.equal((await f.request('/upload', { method: 'POST', headers: { cookie: alice, origin: f.cfg.PUBLIC_URL }, body: full })).status, 413);
  assert.equal(f.assets.size, 1);
});

test('manual plan grants, unsafe downgrades, empty admin and reconciliation failures/recovery', async t => {
  const f = await fixture(); t.after(f.cleanup);
  const login = await f.post('/login', { email: f.cfg.ADMIN_EMAIL, password: f.cfg.ADMIN_PASSWORD });
  const admin = login.headers.get('set-cookie')?.split(';')[0] ?? '';
  assert.match(await (await f.request('/admin', { headers: { cookie: admin } })).text(), /No customers yet/);
  const customer = await f.signUp('customer@example.test');
  const user = f.store.users()[0]; assert.ok(user);
  assert.equal((await f.post('/admin/plan', { id: user.id, plan: 'pro' }, admin)).status, 303);
  assert.equal(f.store.user(user.id)?.plan, 'pro');
  assert.equal(f.accounts.get(user.id)?.quotaSizeInBytes, quota('pro'));
  const account = f.accounts.get(user.id); assert.ok(account); account.quotaUsageInBytes = quota('basic');
  assert.equal((await f.post('/admin/plan', { id: user.id, plan: 'free' }, admin)).status, 409);
  assert.equal(f.store.user(user.id)?.plan, 'pro');
  assert.equal((await f.post('/admin/plan', { id: randomUUID(), plan: 'free' }, admin)).status, 404);
  assert.equal((await f.post('/checkout', { plan: 'basic' }, customer)).status, 503);
  assert.equal((await f.post('/admin/reconcile', {}, admin)).status, 303);
  f.setAvailable(false);
  assert.equal((await f.request('/health/live')).status, 200);
  assert.equal((await f.request('/health/ready')).status, 503);
  await assert.rejects(f.billing.reconcile());
  assert.ok(f.store.jobs()[0]?.error);
  f.setAvailable(true);
  await f.billing.reconcile();
  assert.equal(f.store.jobs()[0]?.error, null);
});

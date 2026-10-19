import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/store.js';
import { config } from '../src/config.js';

test('session persistence, encryption, expiration, revocation and event deduplication', t => {
  const directory = mkdtempSync(join(tmpdir(), 'sphoto-sol-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, 'state.sqlite');
  let store = new Store(file, 'synthetic secret');
  store.addUser({ id: 'one', email: 'one@example.test', name: 'One' });
  const cookie = store.session('one', 'synthetic-immich-bearer-token');
  store.finishEvent('evt_one');
  store.beginCheckout('one', 'pro');
  const checkout = store.checkout('one');
  store.setPlan('one', 'basic', 'cus_one', 'sub_one');
  store.close();
  assert.equal(readFileSync(file).includes(Buffer.from('synthetic-immich-bearer-token')), false);
  assert.equal(readFileSync(file).includes(Buffer.from(cookie)), false);
  store = new Store(file, 'synthetic secret');
  t.after(() => store.close());
  assert.equal(store.getSession(cookie)?.token, 'synthetic-immich-bearer-token');
  assert.equal(store.user('one')?.plan, 'basic');
  assert.equal(store.seenEvent('evt_one'), true);
  assert.deepEqual(store.checkout('one'), checkout);
  assert.equal(store.checkout('one')?.plan, 'pro');
  store.db.exec('UPDATE sessions SET expires=0');
  assert.equal(store.getSession(cookie), undefined);
  store.cleanup();
  const other = store.session('one', 'another-token');
  store.deleteSession(other);
  assert.equal(store.getSession(other), undefined);
});

test('configuration fails closed for incomplete Stripe settings and invalid public origins', () => {
  const input = { ADMIN_EMAIL: 'qa@example.test', ADMIN_PASSWORD: 'synthetic password', SESSION_SECRET: 'synthetic secret longer than 32 characters' };
  assert.throws(() => config({ ...input, BILLING_MODE: 'stripe' }));
  assert.throws(() => config({ ...input, PUBLIC_URL: 'https://example.com/path' }));
  assert.throws(() => config({ ...input, PUBLIC_URL: 'https://example.com/' }));
  assert.equal(config(input).BILLING_MODE, 'manual');
});

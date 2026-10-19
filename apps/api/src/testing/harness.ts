import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, type Config } from '../config';
import { createCtx, type Ctx } from '../context';
import { Db } from '../db';
import { silentLogger } from '../log';
import { MemoryMailer } from '../mail/mailer';
import { FakeBilling } from './fake-billing';
import { FakeImmich } from './fake-immich';

export const TEST_ENV: Record<string, string> = {
  PUBLIC_URL: 'https://sphoto.test',
  ADMIN_API_KEY: 'test-admin-key-0123456789abcdef',
  ADMIN_EMAIL: 'admin@sphoto.test',
  MAIL_PROVIDER: 'smtp',
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'SPhoto <noreply@sphoto.test>',
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  STRIPE_PRICE_BASIC: 'price_basic',
  STRIPE_PRICE_PRO: 'price_pro',
  FREE_IMMICH_URL: 'https://free.sphoto.test',
  FREE_IMMICH_INTERNAL_URL: 'http://free:2283',
  PAID_IMMICH_URL: 'https://photos.sphoto.test',
  PAID_IMMICH_INTERNAL_URL: 'http://paid:2283',
  IMMICH_ADMIN_EMAIL: 'immich-admin@sphoto.test',
  FREE_IMMICH_ADMIN_PASSWORD: 'free-admin-password-1',
  PAID_IMMICH_ADMIN_PASSWORD: 'paid-admin-password-1',
  FREE_QUOTA_GB: '1',
  BASIC_QUOTA_GB: '10',
  PRO_QUOTA_GB: '50',
};

export interface Harness {
  ctx: Ctx;
  config: Config;
  immich: FakeImmich;
  mailer: MemoryMailer;
  billing: FakeBilling;
  /** Moves the test clock forward. */
  advance(ms: number): void;
  now(): Date;
}

export function createHarness(overrides: Record<string, string> = {}): Harness {
  const config = loadConfig({ ...TEST_ENV, DATA_DIR: mkdtempSync(join(tmpdir(), 'sphoto-test-')), ...overrides });
  let time = Date.parse('2026-03-01T12:00:00.000Z');
  const immich = new FakeImmich();
  const mailer = new MemoryMailer();
  const billing = new FakeBilling();
  const ctx = createCtx({ config, db: Db.open(':memory:'), clock: () => new Date(time), log: silentLogger, immich, mailer, billing });
  return { ctx, config, immich, mailer, billing, advance: (ms) => (time += ms), now: () => new Date(time) };
}

export const DAY = 86_400_000;

export function must<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('Expected a value in the test');
  return value;
}

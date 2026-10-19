import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const project = process.env['SPHOTO_E2E_PROJECT'] ?? 'sphoto-e2e';

function load(): Record<string, string> {
  const file = join(import.meta.dirname, '..', `.env.${project}`);
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`Stack env ${file} not found. Run "pnpm --filter @sphoto/e2e stack:up" first.`);
  }
  return Object.fromEntries(
    text
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );
}

const values = load();
const need = (key: string): string => {
  const value = values[key];
  if (!value) throw new Error(`${key} missing in stack env`);
  return value;
};

export const env = {
  appUrl: need('PUBLIC_URL'),
  freeUrl: need('FREE_IMMICH_URL'),
  paidUrl: need('PAID_IMMICH_URL'),
  mailpitUrl: `http://localhost:${need('MAILPIT_PORT')}`,
  adminKey: need('ADMIN_API_KEY'),
  adminMail: need('ADMIN_EMAIL'),
  webhookSecret: need('STRIPE_WEBHOOK_SECRET'),
  freeQuotaBytes: Math.round(Number(need('FREE_QUOTA_GB')) * 1024 ** 3),
};

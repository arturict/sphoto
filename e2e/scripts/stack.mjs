// Starts, stops and inspects the end-to-end stack. Works on Linux, macOS and Windows.
//   node scripts/stack.mjs up      build and start (idempotent); SPHOTO_E2E_PREBUILT=1 skips build and pull
//   node scripts/stack.mjs down    stop and delete containers, volumes and locally built images
//   node scripts/stack.mjs logs    print recent logs
// SPHOTO_E2E_PROJECT and SPHOTO_E2E_PORT_BASE keep parallel runs on one machine apart.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const project = process.env.SPHOTO_E2E_PROJECT ?? 'sphoto-e2e';
const base = Number(process.env.SPHOTO_E2E_PORT_BASE ?? 18000);
const envFile = join(root, 'e2e', `.env.${project}`);

const secret = () => randomBytes(18).toString('hex');
const ports = { app: base + 80, free: base + 283, paid: base + 284, stripeMock: base + 111, mailpit: base + 25 };

// Secrets are generated once per project: the Postgres and Immich volumes keep the first ones.
function ensureEnvFile() {
  if (existsSync(envFile)) return;
  const lines = {
    PUBLIC_URL: `http://localhost:${ports.app}`,
    FREE_IMMICH_URL: `http://localhost:${ports.free}`,
    PAID_IMMICH_URL: `http://localhost:${ports.paid}`,
    APP_PORT: ports.app,
    FREE_PORT: ports.free,
    PAID_PORT: ports.paid,
    STRIPE_MOCK_PORT: ports.stripeMock,
    MAILPIT_PORT: ports.mailpit,
    ADMIN_API_KEY: secret(),
    ADMIN_EMAIL: 'ops@sphoto.test',
    IMMICH_ADMIN_EMAIL: 'photos-admin@sphoto.test',
    FREE_IMMICH_ADMIN_PASSWORD: secret(),
    PAID_IMMICH_ADMIN_PASSWORD: secret(),
    DB_PASSWORD: secret(),
    MAIL_PROVIDER: 'smtp',
    SMTP_URL: 'smtp://mailpit:1025',
    MAIL_FROM: 'SPhoto <noreply@sphoto.test>',
    STRIPE_SECRET_KEY: 'sk_test_e2e',
    STRIPE_WEBHOOK_SECRET: `whsec_${secret()}`,
    STRIPE_PRICE_BASIC: 'price_e2e_basic',
    STRIPE_PRICE_PRO: 'price_e2e_pro',
    STRIPE_API_URL: 'http://stripe-mock:12111',
    // Tiny quotas and graces so the journeys can hit limits and wait out grace periods with synthetic images.
    FREE_QUOTA_GB: '0.004',
    BASIC_QUOTA_GB: '0.05',
    PRO_QUOTA_GB: '0.5',
    DELETION_GRACE_DAYS: '0.00004',
    CANCELLATION_GRACE_DAYS: '0.00004',
    EXPORT_COOLDOWN_DAYS: '0',
    JOBS_INTERVAL_SECONDS: '3600',
    // Every test runs from one address; the production limits would stop repeated runs.
    SIGNUPS_PER_HOUR: '1000',
    LOGIN_AND_CHECKOUT_PER_HOUR: '1000',
    PAID_IMMICH_CONFIG: './docker/immich-paid-noml.json',
    COMPOSE_PROFILES: '',
  };
  writeFileSync(envFile, Object.entries(lines).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
}

function compose(args, options = {}) {
  const full = ['compose', '-p', project, '-f', 'compose.yaml', '-f', 'compose.test.yaml', '--env-file', envFile, ...args];
  const result = spawnSync('docker', full, { cwd: root, stdio: 'inherit', ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const command = process.argv[2];
if (command === 'up') {
  ensureEnvFile();
  // SPHOTO_E2E_PREBUILT=1 starts from images that are already loaded (docker load), without building or pulling.
  const images = process.env.SPHOTO_E2E_PREBUILT === '1' ? ['--no-build', '--pull', 'never'] : ['--build'];
  compose(['up', '-d', ...images, '--wait', '--wait-timeout', '900']);
  console.log(readFileSync(envFile, 'utf8').split('\n').filter((l) => /^(PUBLIC_URL|FREE_IMMICH_URL|PAID_IMMICH_URL|MAILPIT_PORT)=/.test(l)).join('\n'));
} else if (command === 'down') {
  ensureEnvFile();
  compose(['down', '--volumes', '--rmi', 'local', '--remove-orphans']);
  rmSync(envFile, { force: true });
} else if (command === 'logs') {
  ensureEnvFile();
  compose(['logs', '--tail', '200']);
} else {
  console.error('usage: node scripts/stack.mjs up|down|logs');
  process.exit(2);
}

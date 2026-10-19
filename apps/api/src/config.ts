import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const positiveNumber = z.coerce.number().positive();

const envSchema = z.object({
  PORT: z.coerce.number().int().default(3000),
  DATA_DIR: z.string().default('./data'),
  WEB_DIR: z.string().optional(),
  PUBLIC_URL: z.url(),
  ADMIN_API_KEY: z.string().min(24, 'ADMIN_API_KEY needs at least 24 characters'),
  ADMIN_EMAIL: z.email(),

  MAIL_PROVIDER: z.enum(['resend', 'smtp']),
  MAIL_FROM: z.string().min(3),
  RESEND_API_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_BASIC: z.string().min(1),
  STRIPE_PRICE_PRO: z.string().min(1),
  // Points the Stripe SDK at stripe-mock in tests and local runs. Unset in production.
  STRIPE_API_URL: z.url().optional(),

  FREE_IMMICH_URL: z.url(),
  FREE_IMMICH_INTERNAL_URL: z.url(),
  PAID_IMMICH_URL: z.url(),
  PAID_IMMICH_INTERNAL_URL: z.url(),
  IMMICH_ADMIN_EMAIL: z.email(),
  FREE_IMMICH_ADMIN_PASSWORD: z.string().min(12),
  PAID_IMMICH_ADMIN_PASSWORD: z.string().min(12),

  FREE_QUOTA_GB: positiveNumber.default(5),
  BASIC_QUOTA_GB: positiveNumber.default(200),
  PRO_QUOTA_GB: positiveNumber.default(1000),
  BASIC_PRICE_CHF: positiveNumber.default(5),
  PRO_PRICE_CHF: positiveNumber.default(15),

  DELETION_GRACE_DAYS: positiveNumber.default(14),
  CANCELLATION_GRACE_DAYS: positiveNumber.default(14),
  EXPORT_TTL_DAYS: positiveNumber.default(7),
  EXPORT_COOLDOWN_DAYS: z.coerce.number().min(0).default(30),
  EXPORT_ARCHIVE_BYTES: z.coerce.number().int().positive().default(4 * 1024 ** 3),

  // Per client address and hour (the address comes from X-Forwarded-For).
  SIGNUPS_PER_HOUR: z.coerce.number().int().positive().default(5),
  LOGIN_AND_CHECKOUT_PER_HOUR: z.coerce.number().int().positive().default(30),

  JOBS_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
  // Set to false in a second replica or when the tasks run from elsewhere.
  RUN_JOBS: bool.default(true),
});

export type Env = z.infer<typeof envSchema>;

export interface InstanceConfig {
  publicUrl: string;
  internalUrl: string;
  adminPassword: string;
  hasMl: boolean;
}

export interface Config {
  env: Env;
  port: number;
  dataDir: string;
  publicUrl: string;
  instances: { free: InstanceConfig; paid: InstanceConfig };
  quotaGb: { free: number; basic: number; pro: number };
  priceChf: { basic: number; pro: number };
  stripePrices: { basic: string; pro: string };
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');

export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Invalid configuration:\n  ${problems}`);
  }
  const env = parsed.data;
  if (env.MAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is required when MAIL_PROVIDER=resend');
  if (env.MAIL_PROVIDER === 'smtp' && !env.SMTP_URL) throw new Error('SMTP_URL is required when MAIL_PROVIDER=smtp');
  return {
    env,
    port: env.PORT,
    dataDir: env.DATA_DIR,
    publicUrl: trimSlash(env.PUBLIC_URL),
    instances: {
      free: {
        publicUrl: trimSlash(env.FREE_IMMICH_URL),
        internalUrl: trimSlash(env.FREE_IMMICH_INTERNAL_URL),
        adminPassword: env.FREE_IMMICH_ADMIN_PASSWORD,
        hasMl: false,
      },
      paid: {
        publicUrl: trimSlash(env.PAID_IMMICH_URL),
        internalUrl: trimSlash(env.PAID_IMMICH_INTERNAL_URL),
        adminPassword: env.PAID_IMMICH_ADMIN_PASSWORD,
        hasMl: true,
      },
    },
    quotaGb: { free: env.FREE_QUOTA_GB, basic: env.BASIC_QUOTA_GB, pro: env.PRO_QUOTA_GB },
    priceChf: { basic: env.BASIC_PRICE_CHF, pro: env.PRO_PRICE_CHF },
    stripePrices: { basic: env.STRIPE_PRICE_BASIC, pro: env.STRIPE_PRICE_PRO },
  };
}

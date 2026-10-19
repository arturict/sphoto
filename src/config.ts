import { z } from 'zod';

export const planSchema = z.enum(['free', 'basic', 'pro']);
export type Plan = z.infer<typeof planSchema>;
export const plans = {
  free: { name: 'Free', gb: 5, chf: 0 },
  basic: { name: 'Basic', gb: 200, chf: 5 },
  pro: { name: 'Pro', gb: 1000, chf: 15 },
};
export const quota = (plan: Plan) => plans[plan].gb * 1024 ** 3;

const envSchema = z.object({
  PUBLIC_URL: z.url().default('http://localhost:19000'),
  IMMICH_URL: z.url().default('http://localhost:19283'),
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(16),
  SESSION_SECRET: z.string().min(32),
  DATABASE_PATH: z.string().default('data/sphoto.sqlite'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  BILLING_MODE: z.enum(['manual', 'stripe']).default('manual'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  STRIPE_PRICE_BASIC: z.string().default(''),
  STRIPE_PRICE_PRO: z.string().default(''),
});
export function config(env: NodeJS.ProcessEnv) {
  const result = envSchema.parse(env);
  const publicUrl = new URL(result.PUBLIC_URL);
  if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.origin !== result.PUBLIC_URL) {
    throw new Error('PUBLIC_URL must be an HTTP(S) origin with no path or trailing slash');
  }
  if (result.BILLING_MODE === 'stripe' && [result.STRIPE_SECRET_KEY, result.STRIPE_WEBHOOK_SECRET, result.STRIPE_PRICE_BASIC, result.STRIPE_PRICE_PRO].some(v => !v)) {
    throw new Error('Stripe mode requires the secret key, webhook secret, and both price IDs');
  }
  if (result.BILLING_MODE === 'stripe' && result.STRIPE_PRICE_BASIC === result.STRIPE_PRICE_PRO) throw new Error('Stripe price IDs must differ');
  return result;
}
export type Config = ReturnType<typeof config>;

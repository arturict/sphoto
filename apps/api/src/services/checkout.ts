import type { CheckoutStatus, PaidTier } from '@sphoto/shared';
import { z } from 'zod';
import type { Ctx } from '../context';
import { AppError } from '../errors';
import { errorMessage } from '../log';

export async function startCheckout(ctx: Ctx, input: { email: string; plan: PaidTier }): Promise<{ url: string }> {
  const existing = ctx.users.findLiveByEmail(input.email);
  if (existing && existing.tier !== 'free' && !existing.cancellationDueAt) {
    throw new AppError(409, 'Für diese E-Mail-Adresse gibt es bereits ein Abo. Melde dich im Portal an.');
  }
  if (existing?.status === 'migrating') {
    throw new AppError(409, 'Dein Konto wird gerade umgezogen. Bitte versuche es in einigen Minuten erneut.');
  }
  let session: { id: string; url: string };
  try {
    session = await ctx.billing.createCheckout({
      email: input.email,
      plan: input.plan,
      successUrl: `${ctx.config.publicUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${ctx.config.publicUrl}/#preise`,
    });
  } catch (err) {
    ctx.log.error('Creating checkout session failed', { error: errorMessage(err) });
    throw new AppError(502, 'Die Zahlung konnte nicht gestartet werden. Bitte versuche es später erneut.');
  }
  ctx.db.run(
    "INSERT INTO checkout_sessions (id, email, plan, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
    session.id,
    input.email,
    input.plan,
    ctx.clock().toISOString(),
  );
  return { url: session.url };
}

const checkoutRow = z.object({
  status: z.enum(['pending', 'processing', 'complete', 'error']),
  message: z.string().nullable(),
  plan: z.enum(['basic', 'pro']),
});

export function checkoutStatus(ctx: Ctx, sessionId: string): CheckoutStatus {
  const row = ctx.db.get(checkoutRow, 'SELECT status, message, plan FROM checkout_sessions WHERE id = ?', sessionId);
  if (!row) throw new AppError(404, 'Checkout nicht gefunden');
  return {
    status: row.status,
    message: row.message,
    plan: row.plan,
    instanceUrl: row.status === 'complete' ? ctx.config.instances.paid.publicUrl : null,
  };
}

export function setCheckoutStatus(ctx: Ctx, sessionId: string, status: 'pending' | 'processing' | 'complete' | 'error', message: string | null): void {
  ctx.db.run('UPDATE checkout_sessions SET status = ?, message = ? WHERE id = ?', status, message, sessionId);
}

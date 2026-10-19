import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { addDays } from '../clock';
import type { Ctx } from '../context';
import { sendMailSafely } from '../context';
import { AppError } from '../errors';
import { templates } from '../mail/templates';
import type { User } from '../users';

export const MAGIC_LINK_MINUTES = 15;
export const SESSION_DAYS = 7;
const LOGIN_REQUESTS_PER_HOUR = 5;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

/** Always succeeds from the caller's point of view, so the endpoint does not reveal which emails have an account. */
export async function requestLogin(ctx: Ctx, email: string): Promise<void> {
  if (!ctx.rate.allow(`login:${email}`, LOGIN_REQUESTS_PER_HOUR, 3_600_000)) return;
  const user = ctx.users.findLiveByEmail(email);
  if (!user) return;
  const token = newToken();
  const now = ctx.clock();
  ctx.db.run(
    'INSERT INTO magic_links (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    hashToken(token),
    user.id,
    now.toISOString(),
    new Date(now.getTime() + MAGIC_LINK_MINUTES * 60_000).toISOString(),
  );
  const mail = templates.magicLink({ url: `${ctx.config.publicUrl}/portal/login?token=${token}`, minutes: MAGIC_LINK_MINUTES });
  await sendMailSafely(ctx, { to: user.email, ...mail });
}

const magicLinkRow = z.object({ userId: z.string(), expiresAt: z.string(), usedAt: z.string().nullable() });

/** Spends a magic link and returns a new session token. */
export function exchangeMagicLink(ctx: Ctx, token: string): { sessionToken: string; expiresAt: Date } {
  const row = ctx.db.get(
    magicLinkRow,
    'SELECT user_id AS userId, expires_at AS expiresAt, used_at AS usedAt FROM magic_links WHERE token_hash = ?',
    hashToken(token),
  );
  const now = ctx.clock();
  if (!row || row.usedAt || new Date(row.expiresAt) <= now) throw new AppError(401, 'Der Anmeldelink ist ungültig oder abgelaufen');
  const spent = ctx.db.run('UPDATE magic_links SET used_at = ? WHERE token_hash = ? AND used_at IS NULL', now.toISOString(), hashToken(token));
  if (spent.changes !== 1) throw new AppError(401, 'Der Anmeldelink ist ungültig oder abgelaufen');
  const user = ctx.users.get(row.userId);
  if (!user || user.status === 'deleted') throw new AppError(401, 'Der Anmeldelink ist ungültig oder abgelaufen');

  const sessionToken = newToken();
  const expiresAt = addDays(now, SESSION_DAYS);
  ctx.db.run(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    hashToken(sessionToken),
    user.id,
    now.toISOString(),
    expiresAt.toISOString(),
  );
  return { sessionToken, expiresAt };
}

export function authenticate(ctx: Ctx, sessionToken: string | undefined): User | null {
  if (!sessionToken) return null;
  const row = ctx.db.get(
    z.object({ userId: z.string(), expiresAt: z.string() }),
    'SELECT user_id AS userId, expires_at AS expiresAt FROM sessions WHERE token_hash = ?',
    hashToken(sessionToken),
  );
  if (!row || new Date(row.expiresAt) <= ctx.clock()) return null;
  const user = ctx.users.get(row.userId);
  return user && user.status !== 'deleted' ? user : null;
}

export function logout(ctx: Ctx, sessionToken: string): void {
  ctx.db.run('DELETE FROM sessions WHERE token_hash = ?', hashToken(sessionToken));
}

export function purgeExpiredAuth(ctx: Ctx): void {
  const now = ctx.clock().toISOString();
  ctx.db.run('DELETE FROM sessions WHERE expires_at <= ?', now);
  ctx.db.run('DELETE FROM magic_links WHERE expires_at <= ?', now);
}

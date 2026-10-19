import { randomBytes } from 'node:crypto';
import type { Tier } from '@sphoto/shared';
import { AppError } from '../errors';
import type { Ctx } from '../context';
import { errorMessage } from '../log';
import { gbToBytes, tierInstance } from '../plans';
import type { User } from '../users';

export const randomPassword = (): string => randomBytes(15).toString('base64url');

const displayName = (email: string) => email.split('@')[0] ?? email;

export interface CreatedAccount {
  user: User;
  password: string;
}

/**
 * Creates the Immich user and a scoped API key for it, then the SPhoto record. If a later
 * step fails, the Immich user is removed again so no orphan keeps the email address blocked.
 */
export async function createAccount(
  ctx: Ctx,
  input: { email: string; tier: Tier; stripeCustomerId?: string; stripeSubscriptionId?: string },
): Promise<CreatedAccount> {
  const instance = tierInstance(input.tier);
  const quotaGb = ctx.config.quotaGb[input.tier];
  const password = randomPassword();

  const created = await ctx.immich.createUser(instance, {
    email: input.email,
    name: displayName(input.email),
    password,
    quotaBytes: gbToBytes(quotaGb),
  });
  try {
    const apiKey = await ctx.immich.createUserApiKey(instance, { email: input.email, password });
    const user = ctx.users.insert({
      id: crypto.randomUUID(),
      email: input.email,
      tier: input.tier,
      instance,
      immichUserId: created.id,
      immichApiKey: apiKey,
      quotaGb,
      createdAt: ctx.clock().toISOString(),
      ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
      ...(input.stripeSubscriptionId ? { stripeSubscriptionId: input.stripeSubscriptionId } : {}),
    });
    return { user, password };
  } catch (err) {
    await ctx.immich.deleteUser(instance, created.id).catch((cleanupErr: unknown) => {
      ctx.log.error('Could not remove Immich user after failed account creation', { email: input.email, error: errorMessage(cleanupErr) });
    });
    throw err;
  }
}

/** Removes the account's Immich data and anonymises the SPhoto record. */
export async function destroyAccount(ctx: Ctx, user: User): Promise<void> {
  if (user.immichUserId) await ctx.immich.deleteUser(user.instance, user.immichUserId);
  ctx.usageCache.invalidate(user.instance);
  ctx.users.update(user.id, {
    status: 'deleted',
    email: `deleted-${user.id}@deleted.invalid`,
    immichUserId: null,
    immichApiKey: null,
    stripeSubscriptionId: null,
    deletionDueAt: null,
    cancellationDueAt: null,
  });
}

export function requireUser(ctx: Ctx, id: string): User {
  const user = ctx.users.get(id);
  if (!user || user.status === 'deleted') throw new AppError(404, 'Konto nicht gefunden');
  return user;
}

import type {
  AdminAnalytics,
  AdminOverview,
  AdminUser,
  AdminUserDetail,
  InstanceHealth,
  InstanceName,
  PaidTier,
} from '@sphoto/shared';
import { z } from 'zod';
import type { Ctx } from '../context';
import { AppError } from '../errors';
import { errorMessage } from '../log';
import { toJobInfo } from '../repos';
import type { User } from '../users';
import { destroyAccount } from './accounts';
import { applyPlan } from './billing-events';
import { startMigration } from './migration';

const INSTANCES: InstanceName[] = ['free', 'paid'];

async function usageFor(ctx: Ctx, instance: InstanceName) {
  try {
    return await ctx.usageCache.get(instance);
  } catch (err) {
    ctx.log.warn('Could not read usage', { instance, error: errorMessage(err) });
    return null;
  }
}

function toAdminUser(user: User, usedBytes: number | null): AdminUser {
  return {
    id: user.id,
    email: user.email,
    tier: user.tier,
    instance: user.instance,
    status: user.status,
    quotaGb: user.quotaGb,
    usedBytes,
    createdAt: user.createdAt,
    deletionDueAt: user.deletionDueAt,
    cancellationDueAt: user.cancellationDueAt,
    hasSubscription: user.stripeSubscriptionId !== null,
  };
}

export async function listUsers(ctx: Ctx): Promise<AdminUser[]> {
  const usage = { free: await usageFor(ctx, 'free'), paid: await usageFor(ctx, 'paid') };
  return ctx.users.list().map((user) => {
    const entry = user.immichUserId ? usage[user.instance]?.get(user.immichUserId) : undefined;
    return toAdminUser(user, entry?.usageBytes ?? null);
  });
}

export async function userDetail(ctx: Ctx, id: string): Promise<AdminUserDetail> {
  const user = ctx.users.get(id);
  if (!user || user.status === 'deleted') throw new AppError(404, 'Benutzer nicht gefunden');
  const entry = user.immichUserId ? (await usageFor(ctx, user.instance))?.get(user.immichUserId) : undefined;
  return {
    ...toAdminUser(user, entry?.usageBytes ?? null),
    stripeCustomerId: user.stripeCustomerId,
    jobs: ctx.jobs.listForUser(id).map(toJobInfo),
  };
}

/**
 * Sets the tier by hand without touching Stripe. For a free user this starts the migration to
 * the paid instance (the retry path after a failed upgrade); for a paid user it changes the quota.
 */
export async function setTier(ctx: Ctx, id: string, tier: PaidTier): Promise<void> {
  const user = ctx.users.get(id);
  if (!user || user.status === 'deleted') throw new AppError(404, 'Benutzer nicht gefunden');
  if (user.status === 'migrating') throw new AppError(409, 'Der Benutzer wird gerade umgezogen');
  if (user.tier === 'free') {
    if (!startMigration(ctx, id, tier, 'upgrade')) throw new AppError(409, 'Der Benutzer wird gerade umgezogen');
    return;
  }
  await applyPlan(ctx, id, tier);
}

export async function deleteUserNow(ctx: Ctx, id: string, confirmEmail: string): Promise<void> {
  const user = ctx.users.get(id);
  if (!user || user.status === 'deleted') throw new AppError(404, 'Benutzer nicht gefunden');
  if (user.email !== confirmEmail.trim().toLowerCase()) throw new AppError(400, 'Die bestätigte E-Mail-Adresse stimmt nicht überein');
  if (user.status === 'migrating') throw new AppError(409, 'Der Benutzer wird gerade umgezogen');
  if (user.stripeSubscriptionId) await ctx.billing.cancelSubscription(user.stripeSubscriptionId);
  await destroyAccount(ctx, user);
}

export function latestHealth(ctx: Ctx, instance: InstanceName) {
  return ctx.db.get(
    z.object({ ok: z.number(), latencyMs: z.number().nullable(), error: z.string().nullable(), checkedAt: z.string() }),
    'SELECT ok, latency_ms AS latencyMs, error, checked_at AS checkedAt FROM health_checks WHERE instance = ? ORDER BY id DESC LIMIT 1',
    instance,
  );
}

export async function instanceHealth(ctx: Ctx): Promise<InstanceHealth[]> {
  const result: InstanceHealth[] = [];
  for (const instance of INSTANCES) {
    const health = latestHealth(ctx, instance);
    const usage = await usageFor(ctx, instance);
    let usageBytes: number | null = null;
    let photos: number | null = null;
    let videos: number | null = null;
    if (usage) {
      usageBytes = 0;
      photos = 0;
      videos = 0;
      for (const entry of usage.values()) {
        usageBytes += entry.usageBytes;
        photos += entry.photos;
        videos += entry.videos;
      }
    }
    result.push({
      instance,
      url: ctx.config.instances[instance].publicUrl,
      ok: health ? health.ok === 1 : null,
      latencyMs: health?.latencyMs ?? null,
      checkedAt: health?.checkedAt ?? null,
      error: health?.error ?? null,
      users: ctx.users.countByInstance(instance),
      usageBytes,
      photos,
      videos,
    });
  }
  return result;
}

export async function overview(ctx: Ctx): Promise<AdminOverview> {
  const byTier = ctx.users.countByTier();
  const live = ctx.users.list();
  const paying = live.filter((u) => u.tier !== 'free' && !u.cancellationDueAt && u.stripeSubscriptionId);
  const mrrChf = paying.reduce((sum, u) => sum + (u.tier === 'basic' ? ctx.config.priceChf.basic : ctx.config.priceChf.pro), 0);
  const weekAgo = new Date(ctx.clock().getTime() - 7 * 86_400_000).toISOString();
  return {
    users: { total: byTier.free + byTier.basic + byTier.pro, ...byTier },
    mrrChf,
    pendingDeletions: live.filter((u) => u.deletionDueAt).length,
    pendingCancellations: live.filter((u) => u.cancellationDueAt).length,
    failedJobs: ctx.jobs.countFailedSince(weekAgo),
    instances: await instanceHealth(ctx),
  };
}

export function analytics(ctx: Ctx, days: number): AdminAnalytics {
  const since = new Date(ctx.clock().getTime() - days * 86_400_000).toISOString().slice(0, 10);
  const signups = ctx.db.all(
    z.object({ date: z.string(), count: z.number() }),
    'SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM users WHERE substr(created_at, 1, 10) >= ? GROUP BY date ORDER BY date',
    since,
  );
  const storage = ctx.db.all(
    z.object({ date: z.string(), bytes: z.number() }),
    'SELECT date, SUM(bytes) AS bytes FROM usage_snapshots WHERE date >= ? GROUP BY date ORDER BY date',
    since,
  );
  const topUsers = ctx.db.all(
    z.object({ userId: z.string(), email: z.string(), usageBytes: z.number() }),
    `SELECT s.user_id AS userId, u.email AS email, s.bytes AS usageBytes
     FROM usage_snapshots s JOIN users u ON u.id = s.user_id
     WHERE u.status != 'deleted' AND s.date = (SELECT MAX(date) FROM usage_snapshots)
     ORDER BY s.bytes DESC LIMIT 10`,
  );
  return { days, signups, storage, topUsers };
}

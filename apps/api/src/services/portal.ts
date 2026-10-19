import type { PaidTier, PortalMe } from '@sphoto/shared';
import { addDays } from '../clock';
import { sendMailSafely, type Ctx } from '../context';
import { AppError } from '../errors';
import { errorMessage } from '../log';
import { templates } from '../mail/templates';
import { tierName } from '../plans';
import type { User } from '../users';
import { startCheckout } from './checkout';
import { latestExport } from './exports';
import { toJobInfo } from '../repos';

const DAY_MS = 86_400_000;

export async function portalMe(ctx: Ctx, user: User): Promise<PortalMe> {
  let usage: { usedBytes: number; photos: number; videos: number } | null = null;
  if (user.immichUserId && user.status !== 'migrating') {
    try {
      const entry = (await ctx.usageCache.get(user.instance)).get(user.immichUserId);
      if (entry) usage = { usedBytes: entry.usageBytes, photos: entry.photos, videos: entry.videos };
    } catch (err) {
      ctx.log.warn('Could not read usage for portal', { userId: user.id, error: errorMessage(err) });
    }
  }
  const nextExport = user.lastExportAt ? new Date(new Date(user.lastExportAt).getTime() + ctx.config.env.EXPORT_COOLDOWN_DAYS * DAY_MS) : null;
  const job = ctx.jobs.latestForUser(user.id);
  return {
    email: user.email,
    tier: user.tier,
    planName: tierName(user.tier),
    quotaGb: user.quotaGb,
    usedBytes: usage?.usedBytes ?? null,
    photos: usage?.photos ?? null,
    videos: usage?.videos ?? null,
    instanceUrl: ctx.config.instances[user.instance].publicUrl,
    hasMl: ctx.config.instances[user.instance].hasMl,
    createdAt: user.createdAt,
    migrating: user.status === 'migrating',
    deletionDueAt: user.deletionDueAt,
    cancellationDueAt: user.cancellationDueAt,
    canUpgrade: user.tier === 'free' && user.status === 'active',
    canManageBilling: user.stripeCustomerId !== null,
    nextExportAt: nextExport && nextExport > ctx.clock() ? nextExport.toISOString() : null,
    latestExport: latestExport(ctx, user.id),
    latestJob: job ? toJobInfo(job) : null,
  };
}

export async function requestDeletion(ctx: Ctx, user: User): Promise<string> {
  if (user.status === 'migrating') throw new AppError(409, 'Dein Konto wird gerade umgezogen. Bitte versuche es später erneut.');
  if (user.deletionDueAt) return user.deletionDueAt;
  const dueAt = addDays(ctx.clock(), ctx.config.env.DELETION_GRACE_DAYS).toISOString();
  ctx.users.update(user.id, { deletionDueAt: dueAt });
  await sendMailSafely(ctx, { to: user.email, ...templates.deletionScheduled({ dueAt, portalUrl: `${ctx.config.publicUrl}/portal` }) });
  return dueAt;
}

export async function cancelDeletion(ctx: Ctx, user: User): Promise<void> {
  if (!user.deletionDueAt) return;
  ctx.users.update(user.id, { deletionDueAt: null });
  await sendMailSafely(ctx, { to: user.email, ...templates.deletionCancelled() });
}

export async function upgradeUrl(ctx: Ctx, user: User, plan: PaidTier): Promise<string> {
  if (user.tier !== 'free') throw new AppError(409, 'Du hast bereits ein Abo. Den Plan änderst du über die Abrechnung.');
  return (await startCheckout(ctx, { email: user.email, plan })).url;
}

export async function billingPortalUrl(ctx: Ctx, user: User): Promise<string> {
  if (!user.stripeCustomerId) throw new AppError(409, 'Für dein Konto gibt es keine Abrechnung.');
  try {
    return (await ctx.billing.createPortalSession(user.stripeCustomerId, `${ctx.config.publicUrl}/portal`)).url;
  } catch (err) {
    ctx.log.error('Creating billing portal session failed', { error: errorMessage(err) });
    throw new AppError(502, 'Die Abrechnung ist gerade nicht erreichbar. Bitte versuche es später erneut.');
  }
}

import type { Tier } from '@sphoto/shared';
import type { Ctx } from '../context';
import { sendMailSafely } from '../context';
import { errorMessage } from '../log';
import { templates } from '../mail/templates';
import { gbToBytes, tierInstance, tierName } from '../plans';
import type { User } from '../users';
import { randomPassword } from './accounts';

export interface MigrationResult {
  ok: boolean;
  migrated: number;
  error: string | null;
}

const MAX_REPORTED_ERRORS = 5;

interface CopyResult {
  total: number;
  copied: number;
  errors: string[];
}

// Copies every asset (and then the albums) from one Immich user to another, streaming each file.
// Hidden assets are listed first because they hold the motion part of live photos.
async function copyLibrary(
  ctx: Ctx,
  jobId: string,
  source: { instance: User['instance']; apiKey: string },
  target: { instance: User['instance']; apiKey: string },
): Promise<CopyResult> {
  const assets = [];
  for await (const asset of ctx.immich.listAssets(source.instance, source.apiKey)) assets.push(asset);

  const idMap = new Map<string, string>();
  const errors: string[] = [];
  let copied = 0;
  ctx.jobs.progress(jobId, 0, assets.length);

  for (const asset of assets) {
    try {
      const stream = await ctx.immich.downloadAsset(source.instance, source.apiKey, asset.id);
      try {
        const uploaded = await ctx.immich.uploadAsset(target.instance, target.apiKey, {
          stream,
          filename: asset.originalFileName,
          fileCreatedAt: asset.fileCreatedAt,
          fileModifiedAt: asset.fileModifiedAt,
          isFavorite: asset.isFavorite,
          visibility: asset.visibility,
          livePhotoVideoId: asset.livePhotoVideoId ? (idMap.get(asset.livePhotoVideoId) ?? null) : null,
        });
        idMap.set(asset.id, uploaded.id);
        copied++;
      } catch (err) {
        await stream.cancel().catch(() => undefined);
        throw err;
      }
    } catch (err) {
      errors.push(`${asset.originalFileName}: ${errorMessage(err)}`);
    }
    ctx.jobs.progress(jobId, copied + errors.length, assets.length);
  }

  if (errors.length === 0) {
    for (const album of await ctx.immich.listAlbums(source.instance, source.apiKey)) {
      const ids = await ctx.immich.listAlbumAssetIds(source.instance, source.apiKey, album.id);
      const mapped = ids.map((id) => idMap.get(id)).filter((id): id is string => id !== undefined);
      await ctx.immich.createAlbum(target.instance, target.apiKey, { name: album.name, description: album.description, assetIds: mapped });
    }
  }
  return { total: assets.length, copied, errors };
}

/**
 * Moves a user to the Immich instance that belongs to `targetTier`. The source account stays
 * untouched until every asset has arrived, so a failed run loses nothing and can be repeated.
 */
export async function migrateUser(ctx: Ctx, userId: string, targetTier: Tier, jobId: string): Promise<MigrationResult> {
  const user = ctx.users.require(userId);
  const sourceKey = user.immichApiKey;
  if (!user.immichUserId || !sourceKey) return failMigration(ctx, user, jobId, 'Für dieses Konto ist kein Immich-Zugang gespeichert');

  const targetInstance = tierInstance(targetTier);
  const targetQuotaGb = ctx.config.quotaGb[targetTier];
  const password = randomPassword();
  let targetUserId: string | null = null;

  try {
    const created = await ctx.immich.createUser(targetInstance, {
      email: user.email,
      name: user.email.split('@')[0] ?? user.email,
      password,
      quotaBytes: gbToBytes(targetQuotaGb),
    });
    targetUserId = created.id;
    const targetKey = await ctx.immich.createUserApiKey(targetInstance, { email: user.email, password });

    const copy = await copyLibrary(
      ctx,
      jobId,
      { instance: user.instance, apiKey: sourceKey },
      { instance: targetInstance, apiKey: targetKey },
    );
    if (copy.errors.length > 0) {
      const shown = copy.errors.slice(0, MAX_REPORTED_ERRORS).join('; ');
      throw new Error(`${copy.errors.length} von ${copy.total} Dateien konnten nicht kopiert werden: ${shown}`);
    }

    ctx.users.update(user.id, {
      tier: targetTier,
      instance: targetInstance,
      status: 'active',
      immichUserId: created.id,
      immichApiKey: targetKey,
      quotaGb: targetQuotaGb,
      cancellationDueAt: null,
    });
    ctx.usageCache.invalidate(user.instance);
    ctx.usageCache.invalidate(targetInstance);
    ctx.jobs.succeed(jobId);

    await ctx.immich.deleteUser(user.instance, user.immichUserId).catch((err: unknown) => {
      ctx.log.error('Source Immich user could not be removed after migration', { userId: user.id, error: errorMessage(err) });
    });

    const mail =
      targetTier === 'free'
        ? templates.downgradeDone({ instanceUrl: ctx.config.instances.free.publicUrl, email: user.email, password, quotaGb: targetQuotaGb })
        : templates.upgradeDone({
            planName: tierName(targetTier),
            quotaGb: targetQuotaGb,
            instanceUrl: ctx.config.instances[targetInstance].publicUrl,
            email: user.email,
            password,
            migrated: copy.copied,
          });
    await sendMailSafely(ctx, { to: user.email, ...mail });
    return { ok: true, migrated: copy.copied, error: null };
  } catch (err) {
    if (targetUserId) {
      await ctx.immich.deleteUser(targetInstance, targetUserId).catch((cleanupErr: unknown) => {
        ctx.log.error('Target Immich user could not be removed after failed migration', { userId: user.id, error: errorMessage(cleanupErr) });
      });
    }
    return failMigration(ctx, user, jobId, errorMessage(err));
  }
}

async function failMigration(ctx: Ctx, user: User, jobId: string, error: string): Promise<MigrationResult> {
  ctx.log.error('Migration failed', { userId: user.id, error });
  ctx.jobs.fail(jobId, error);
  ctx.users.update(user.id, { status: 'active' });
  await sendMailSafely(ctx, { to: user.email, ...templates.upgradeFailed({ portalUrl: `${ctx.config.publicUrl}/portal` }) });
  await sendMailSafely(ctx, {
    to: ctx.config.env.ADMIN_EMAIL,
    ...templates.adminAlert({ subject: 'Migration fehlgeschlagen', text: `Benutzer ${user.id} (${user.email}): ${error}` }),
  });
  return { ok: false, migrated: 0, error };
}

/** Starts a migration in the background. Returns null if another migration already holds the user. */
export function startMigration(
  ctx: Ctx,
  userId: string,
  targetTier: Tier,
  kind: 'upgrade' | 'downgrade',
  onFinished?: (result: MigrationResult) => void,
): { jobId: string } | null {
  if (!ctx.users.beginMigration(userId)) return null;
  const job = ctx.jobs.create(kind, userId);
  ctx.background.run(`${kind}:${userId}`, async () => {
    const result = await migrateUser(ctx, userId, targetTier, job.id);
    onFinished?.(result);
  });
  return { jobId: job.id };
}

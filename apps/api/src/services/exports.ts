import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { ExportInfo } from '@sphoto/shared';
import { z } from 'zod';
import { addDays } from '../clock';
import { sendMailSafely, type Ctx } from '../context';
import { AppError } from '../errors';
import { errorMessage } from '../log';
import { templates } from '../mail/templates';
import type { User } from '../users';

const DAY_MS = 86_400_000;

const exportsDir = (ctx: Ctx) => join(ctx.config.dataDir, 'exports');

export function requestExport(ctx: Ctx, user: User): { jobId: string } {
  if (user.status !== 'active') throw new AppError(409, 'Dein Konto wird gerade umgezogen. Bitte versuche es später erneut.');
  if (!user.immichApiKey) throw new AppError(409, 'Für dein Konto ist kein Export möglich. Bitte kontaktiere den Support.');
  const cooldownMs = ctx.config.env.EXPORT_COOLDOWN_DAYS * DAY_MS;
  if (user.lastExportAt && ctx.clock().getTime() - new Date(user.lastExportAt).getTime() < cooldownMs) {
    throw new AppError(429, `Ein Export ist nur alle ${ctx.config.env.EXPORT_COOLDOWN_DAYS} Tage möglich.`);
  }
  const running = ctx.jobs.latestForUser(user.id);
  if (running?.kind === 'export' && running.status === 'running') throw new AppError(409, 'Ein Export läuft bereits.');

  const job = ctx.jobs.create('export', user.id);
  ctx.users.update(user.id, { lastExportAt: ctx.clock().toISOString() });
  ctx.background.run(`export:${user.id}`, () => runExport(ctx, user.id, job.id, user.lastExportAt));
  return { jobId: job.id };
}

async function runExport(ctx: Ctx, userId: string, jobId: string, previousExportAt: string | null): Promise<void> {
  const user = ctx.users.require(userId);
  const exportId = crypto.randomUUID();
  const dir = join(exportsDir(ctx), exportId);
  try {
    if (!user.immichApiKey) throw new Error('Kein Immich-Zugang gespeichert');
    const archives = await ctx.immich.planDownload(user.instance, user.immichApiKey, ctx.config.env.EXPORT_ARCHIVE_BYTES);
    if (archives.length === 0) throw new EmptyLibraryError();
    ctx.jobs.progress(jobId, 0, archives.length);
    await mkdir(dir, { recursive: true });

    const parts: { index: number; sizeBytes: number; sha256: string }[] = [];
    for (const [index, archive] of archives.entries()) {
      const body = await ctx.immich.downloadArchive(user.instance, user.immichApiKey, archive.assetIds);
      const hash = createHash('sha256');
      let sizeBytes = 0;
      const meter = new Transform({
        transform(chunk: Buffer, _enc, done) {
          hash.update(chunk);
          sizeBytes += chunk.length;
          done(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(body as NodeReadableStream), meter, createWriteStream(join(dir, `part-${index}.zip`)));
      parts.push({ index, sizeBytes, sha256: hash.digest('hex') });
      ctx.jobs.progress(jobId, index + 1, archives.length);
    }

    const now = ctx.clock();
    const expiresAt = addDays(now, ctx.config.env.EXPORT_TTL_DAYS).toISOString();
    ctx.db.transaction(() => {
      ctx.db.run('INSERT INTO exports (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', exportId, userId, now.toISOString(), expiresAt);
      for (const part of parts) {
        ctx.db.run('INSERT INTO export_parts (export_id, idx, size_bytes, sha256) VALUES (?, ?, ?, ?)', exportId, part.index, part.sizeBytes, part.sha256);
      }
    });
    ctx.jobs.succeed(jobId);
    await sendMailSafely(ctx, { to: user.email, ...templates.exportReady({ parts, expiresAt, portalUrl: `${ctx.config.publicUrl}/portal` }) });
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    // A failed or empty export should not use up the cooldown.
    ctx.users.update(userId, { lastExportAt: previousExportAt });
    const empty = err instanceof EmptyLibraryError;
    ctx.jobs.fail(jobId, empty ? 'Dein Konto enthält noch keine Fotos oder Videos.' : errorMessage(err));
    if (!empty) {
      ctx.log.error('Export failed', { userId, error: errorMessage(err) });
      await sendMailSafely(ctx, { to: user.email, ...templates.exportFailed() });
    }
  }
}

class EmptyLibraryError extends Error {}

const exportRow = z.object({ id: z.string(), createdAt: z.string(), expiresAt: z.string() });
const partRow = z.object({ index: z.number(), sizeBytes: z.number(), sha256: z.string() });

export function latestExport(ctx: Ctx, userId: string): ExportInfo | null {
  const row = ctx.db.get(
    exportRow,
    `SELECT id, created_at AS createdAt, expires_at AS expiresAt FROM exports
     WHERE user_id = ? AND removed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1`,
    userId,
    ctx.clock().toISOString(),
  );
  if (!row) return null;
  const parts = ctx.db.all(partRow, 'SELECT idx AS "index", size_bytes AS sizeBytes, sha256 FROM export_parts WHERE export_id = ? ORDER BY idx', row.id);
  return { ...row, parts };
}

export function exportPartStream(ctx: Ctx, userId: string, exportId: string, index: number): { stream: Readable; sizeBytes: number; filename: string } {
  const info = latestExport(ctx, userId);
  const part = info?.id === exportId ? info.parts.find((p) => p.index === index) : undefined;
  if (!info || !part) throw new AppError(404, 'Export nicht gefunden oder abgelaufen');
  return {
    stream: createReadStream(join(exportsDir(ctx), exportId, `part-${index}.zip`)),
    sizeBytes: part.sizeBytes,
    filename: `sphoto-export-${index + 1}.zip`,
  };
}

export async function cleanupExports(ctx: Ctx): Promise<number> {
  const expired = ctx.db.all(z.object({ id: z.string() }), 'SELECT id FROM exports WHERE removed_at IS NULL AND expires_at <= ?', ctx.clock().toISOString());
  for (const { id } of expired) {
    await rm(join(exportsDir(ctx), id), { recursive: true, force: true });
    ctx.db.run('UPDATE exports SET removed_at = ? WHERE id = ?', ctx.clock().toISOString(), id);
  }
  return expired.length;
}

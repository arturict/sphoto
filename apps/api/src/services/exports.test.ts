import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { runMaintenance } from '../jobs/maintenance';
import { createHarness, DAY, must, type Harness } from '../testing/harness';
import { cleanupExports, exportPartStream, latestExport, requestExport } from './exports';
import { freeSignup } from './signup';

let h: Harness;
beforeEach(async () => {
  h = createHarness({ EXPORT_ARCHIVE_BYTES: '10' });
  await freeSignup(h.ctx, { email: 'ida@example.com', clientKey: 'i' });
  h.mailer.sent.length = 0;
});

const user = () => must(h.ctx.users.findLiveByEmail('ida@example.com'));
const readAll = async (stream: AsyncIterable<Buffer>) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
};

describe('export', () => {
  it('splits the library into archives, hashes each part and mails the owner', async () => {
    h.immich.seedAsset('free', 'ida@example.com', { filename: 'one.jpg', content: '123456' });
    h.immich.seedAsset('free', 'ida@example.com', { filename: 'two.jpg', content: '123457' });

    const { jobId } = requestExport(h.ctx, user());
    await h.ctx.background.idle();

    expect(h.ctx.jobs.require(jobId)).toMatchObject({ status: 'succeeded', done: 2, total: 2 });
    const info = latestExport(h.ctx, user().id);
    expect(info?.parts).toHaveLength(2);
    expect(info?.parts[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
    const part = exportPartStream(h.ctx, user().id, info?.id ?? '', 0);
    expect(await readAll(part.stream)).toBe('ZIP[one.jpg]');
    expect(part.sizeBytes).toBe('ZIP[one.jpg]'.length);
    expect(h.mailer.to('ida@example.com')[0]?.subject).toContain('Export');
  });

  it('allows one export per cooldown period', async () => {
    h.immich.seedAsset('free', 'ida@example.com', { filename: 'one.jpg', content: '1' });
    requestExport(h.ctx, user());
    await h.ctx.background.idle();
    expect(() => requestExport(h.ctx, user())).toThrow('alle 30 Tage');
    h.advance(31 * DAY);
    expect(() => requestExport(h.ctx, user())).not.toThrow();
  });

  it('does not use up the cooldown when the library is empty or the export fails', async () => {
    const { jobId } = requestExport(h.ctx, user());
    await h.ctx.background.idle();
    expect(h.ctx.jobs.require(jobId)).toMatchObject({ status: 'failed', error: 'Dein Konto enthält noch keine Fotos oder Videos.' });
    expect(user().lastExportAt).toBeNull();

    h.immich.seedAsset('free', 'ida@example.com', { filename: 'one.jpg', content: '1' });
    h.immich.downloadArchive = () => Promise.reject(new Error('immich exploded'));
    const failed = requestExport(h.ctx, user());
    await h.ctx.background.idle();
    expect(h.ctx.jobs.require(failed.jobId).status).toBe('failed');
    expect(user().lastExportAt).toBeNull();
    expect(h.mailer.to('ida@example.com').at(-1)?.subject).toContain('fehlgeschlagen');
    expect(latestExport(h.ctx, user().id)).toBeNull();
  });

  it('serves a part only to its owner and only until it expires, and then removes the files', async () => {
    h.immich.seedAsset('free', 'ida@example.com', { filename: 'one.jpg', content: '1' });
    requestExport(h.ctx, user());
    await h.ctx.background.idle();
    const id = latestExport(h.ctx, user().id)?.id ?? '';

    expect(() => exportPartStream(h.ctx, 'someone-else', id, 0)).toThrow('nicht gefunden');
    const file = join(h.config.dataDir, 'exports', id, 'part-0.zip');
    expect(existsSync(file)).toBe(true);

    h.advance(8 * DAY);
    expect(latestExport(h.ctx, user().id)).toBeNull();
    expect(() => exportPartStream(h.ctx, user().id, id, 0)).toThrow('abgelaufen');
    await runMaintenance(h.ctx);
    expect(existsSync(file)).toBe(false);
    expect(await cleanupExports(h.ctx)).toBe(0);
  });
});

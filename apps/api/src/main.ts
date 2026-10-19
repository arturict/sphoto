import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { InstanceName } from '@sphoto/shared';
import { StripeBilling } from './billing/stripe';
import { systemClock } from './clock';
import { loadConfig } from './config';
import { createCtx } from './context';
import { Db } from './db';
import { HttpImmichGateway } from './immich/http';
import { startScheduler } from './jobs/maintenance';
import { consoleLogger, errorMessage } from './log';
import { createMailer } from './mail/mailer';
import { createApp } from './http/app';
import { z } from 'zod';

const log = consoleLogger;
const config = loadConfig();
const db = Db.open(join(config.dataDir, 'sphoto.db'));

const adminKeys = {
  get: (instance: InstanceName) => db.get(z.object({ key: z.string() }), 'SELECT admin_api_key AS key FROM instances WHERE name = ?', instance)?.key,
  set: (instance: InstanceName, key: string) => {
    db.run('INSERT OR REPLACE INTO instances (name, admin_api_key, created_at) VALUES (?, ?, ?)', instance, key, new Date().toISOString());
  },
};

const ctx = createCtx({
  config,
  db,
  clock: systemClock,
  log,
  immich: new HttpImmichGateway(config, adminKeys, log),
  mailer: createMailer(config),
  billing: new StripeBilling(config),
});

const interrupted = ctx.jobs.failInterrupted();
if (interrupted > 0) log.warn('Marked interrupted jobs as failed', { count: interrupted });

const app = createApp(ctx);

if (config.env.WEB_DIR) {
  const webDir = config.env.WEB_DIR;
  const indexHtml = await readFile(join(webDir, 'index.html'), 'utf8');
  app.use('*', serveStatic({ root: webDir }));
  // Client-side routes (/portal, /admin, ...) all serve the SPA shell.
  app.get('*', (c) => c.html(indexHtml));
}

serve({ fetch: app.fetch, port: config.port }, (info) => log.info('SPhoto API listening', { port: info.port }));

// Immich needs a minute to migrate its database on first start. The API serves requests meanwhile
// (sign-up answers with a 503 until the instance is ready) and keeps retrying the setup.
async function bootstrap(instance: InstanceName): Promise<void> {
  for (;;) {
    try {
      await ctx.immich.ensureReady(instance);
      ctx.readiness[instance] = 'ready';
      log.info('Immich ready', { instance });
      return;
    } catch (err) {
      log.error('Immich setup failed, retrying', { instance, error: errorMessage(err) });
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
}
void bootstrap('free');
void bootstrap('paid');

if (config.env.RUN_JOBS) startScheduler(ctx, config.env.JOBS_INTERVAL_SECONDS);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log.info('Shutting down', { signal });
    void ctx.background.idle().finally(() => {
      db.close();
      process.exit(0);
    });
  });
}

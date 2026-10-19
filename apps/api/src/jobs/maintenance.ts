import type { InstanceName, MaintenanceReport } from '@sphoto/shared';
import { z } from 'zod';
import { sendMailSafely, type Ctx } from '../context';
import { errorMessage } from '../log';
import { templates } from '../mail/templates';
import { gbToBytes } from '../plans';
import { destroyAccount } from '../services/accounts';
import { purgeExpiredAuth } from '../services/auth';
import { cleanupExports } from '../services/exports';
import { startMigration } from '../services/migration';

const DAY_MS = 86_400_000;
const REMINDER_DAYS = [7, 3, 1];
const QUOTA_THRESHOLDS = [80, 95];
const QUOTA_CLEAR_BELOW = 75;
const DOWN_AFTER_FAILURES = 2;
const KEEP_HEALTH_ROWS = 200;

type Task = { name: string; run: (ctx: Ctx) => Promise<string> };

async function processDeletions(ctx: Ctx): Promise<string> {
  const due = ctx.users.dueFor('deletionDueAt', ctx.clock().toISOString());
  let deleted = 0;
  for (const user of due) {
    try {
      if (user.stripeSubscriptionId) await ctx.billing.cancelSubscription(user.stripeSubscriptionId);
      await destroyAccount(ctx, user);
      await sendMailSafely(ctx, { to: user.email, ...templates.deletionDone() });
      deleted++;
    } catch (err) {
      ctx.log.error('Scheduled deletion failed, will retry', { userId: user.id, error: errorMessage(err) });
    }
  }
  return `${deleted} von ${due.length} fälligen Konten gelöscht`;
}

async function processCancellations(ctx: Ctx): Promise<string> {
  const due = ctx.users.dueFor('cancellationDueAt', ctx.clock().toISOString()).filter((u) => !u.deletionDueAt);
  let started = 0;
  let blocked = 0;
  const freeQuotaBytes = gbToBytes(ctx.config.quotaGb.free);
  for (const user of due) {
    try {
      const entry = user.immichUserId ? (await ctx.usageCache.get(user.instance, { fresh: true })).get(user.immichUserId) : undefined;
      const usedBytes = entry?.usageBytes ?? 0;
      if (usedBytes > freeQuotaBytes) {
        // Nothing is deleted. The account stays as it is until the user makes room or subscribes again.
        blocked++;
        if (!ctx.notices.has(user.id, 'downgrade_blocked')) {
          ctx.notices.mark(user.id, 'downgrade_blocked');
          await sendMailSafely(ctx, {
            to: user.email,
            ...templates.downgradeBlocked({ usedGb: (usedBytes / 1024 ** 3).toFixed(1), freeQuotaGb: ctx.config.quotaGb.free, portalUrl: `${ctx.config.publicUrl}/portal` }),
          });
          await sendMailSafely(ctx, {
            to: ctx.config.env.ADMIN_EMAIL,
            ...templates.adminAlert({ subject: 'Downgrade blockiert', text: `${user.email} belegt ${(usedBytes / 1024 ** 3).toFixed(1)} GB und passt nicht in den Free-Plan.` }),
          });
        }
        continue;
      }
      if (startMigration(ctx, user.id, 'free', 'downgrade')) started++;
    } catch (err) {
      ctx.log.error('Scheduled downgrade failed, will retry', { userId: user.id, error: errorMessage(err) });
    }
  }
  return `${started} Downgrades gestartet, ${blocked} blockiert (zu viel Speicher)`;
}

async function sendCancellationReminders(ctx: Ctx): Promise<string> {
  const now = ctx.clock();
  let sent = 0;
  for (const user of ctx.users.list()) {
    if (!user.cancellationDueAt || user.deletionDueAt) continue;
    const msLeft = new Date(user.cancellationDueAt).getTime() - now.getTime();
    if (msLeft <= 0) continue;
    const daysLeft = Math.ceil(msLeft / DAY_MS);
    // Only the tightest threshold that applies, so a short grace period does not trigger all reminders at once.
    const threshold = [...REMINDER_DAYS].reverse().find((t) => daysLeft <= t);
    if (threshold === undefined) continue;
    const kind = `cancellation_reminder_${threshold}`;
    if (ctx.notices.has(user.id, kind)) continue;
    for (const t of REMINDER_DAYS.filter((t) => t >= threshold)) ctx.notices.mark(user.id, `cancellation_reminder_${t}`);
    await sendMailSafely(ctx, {
      to: user.email,
      ...templates.cancellationReminder({ daysLeft, endsAt: user.cancellationDueAt, portalUrl: `${ctx.config.publicUrl}/portal` }),
    });
    sent++;
  }
  return `${sent} Erinnerungen gesendet`;
}

// One reading per instance feeds both the daily storage snapshot and the quota warnings.
async function collectUsage(ctx: Ctx): Promise<string> {
  const today = ctx.clock().toISOString().slice(0, 10);
  let snapshots = 0;
  let warnings = 0;
  const instances: InstanceName[] = ['free', 'paid'];
  for (const instance of instances) {
    const usage = await ctx.usageCache.get(instance, { fresh: true });
    for (const user of ctx.users.list().filter((u) => u.instance === instance && u.status === 'active')) {
      const entry = user.immichUserId ? usage.get(user.immichUserId) : undefined;
      if (!entry) continue;
      ctx.db.run(
        'INSERT OR REPLACE INTO usage_snapshots (date, user_id, bytes, photos, videos) VALUES (?, ?, ?, ?, ?)',
        today,
        user.id,
        entry.usageBytes,
        entry.photos,
        entry.videos,
      );
      snapshots++;

      const percent = (entry.usageBytes / gbToBytes(user.quotaGb)) * 100;
      if (percent < QUOTA_CLEAR_BELOW) {
        ctx.notices.clearScope(user.id, 'quota_');
        continue;
      }
      const threshold = [...QUOTA_THRESHOLDS].reverse().find((t) => percent >= t);
      if (threshold === undefined || ctx.notices.has(user.id, `quota_${threshold}`)) continue;
      for (const t of QUOTA_THRESHOLDS.filter((t) => t <= threshold)) ctx.notices.mark(user.id, `quota_${t}`);
      await sendMailSafely(ctx, {
        to: user.email,
        ...templates.quotaWarning({
          percent: threshold,
          usedGb: (entry.usageBytes / 1024 ** 3).toFixed(1),
          quotaGb: user.quotaGb,
          portalUrl: `${ctx.config.publicUrl}/portal`,
          canUpgrade: user.tier === 'free',
        }),
      });
      warnings++;
    }
  }
  return `${snapshots} Messungen, ${warnings} Speicherwarnungen`;
}

async function checkHealth(ctx: Ctx): Promise<string> {
  const states: string[] = [];
  for (const instance of ['free', 'paid'] as const) {
    const result = await ctx.immich.ping(instance);
    ctx.db.run(
      'INSERT INTO health_checks (instance, ok, latency_ms, error, checked_at) VALUES (?, ?, ?, ?, ?)',
      instance,
      result.ok ? 1 : 0,
      result.latencyMs,
      result.error,
      ctx.clock().toISOString(),
    );
    ctx.db.run(
      'DELETE FROM health_checks WHERE instance = ? AND id <= (SELECT MAX(id) FROM health_checks WHERE instance = ?) - ?',
      instance,
      instance,
      KEEP_HEALTH_ROWS,
    );
    states.push(`${instance}: ${result.ok ? 'ok' : 'down'}`);

    const recent = ctx.db.all(
      z.object({ ok: z.number() }),
      'SELECT ok FROM health_checks WHERE instance = ? ORDER BY id DESC LIMIT ?',
      instance,
      DOWN_AFTER_FAILURES,
    );
    const isDown = recent.length === DOWN_AFTER_FAILURES && recent.every((r) => r.ok === 0);
    if (isDown && !ctx.notices.has(instance, 'instance_down')) {
      ctx.notices.mark(instance, 'instance_down');
      await sendMailSafely(ctx, {
        to: ctx.config.env.ADMIN_EMAIL,
        ...templates.adminAlert({ subject: `Immich ${instance} nicht erreichbar`, text: `${ctx.config.instances[instance].publicUrl}: ${result.error ?? 'keine Antwort'}` }),
      });
    } else if (result.ok && ctx.notices.has(instance, 'instance_down')) {
      ctx.notices.clear(instance, 'instance_down');
      await sendMailSafely(ctx, {
        to: ctx.config.env.ADMIN_EMAIL,
        ...templates.adminAlert({ subject: `Immich ${instance} ist wieder erreichbar`, text: ctx.config.instances[instance].publicUrl }),
      });
    }
  }
  return states.join(', ');
}

async function cleanup(ctx: Ctx): Promise<string> {
  purgeExpiredAuth(ctx);
  const exports = await cleanupExports(ctx);
  return `${exports} abgelaufene Exporte entfernt`;
}

const TASKS: Task[] = [
  { name: 'deletions', run: processDeletions },
  { name: 'cancellations', run: processCancellations },
  { name: 'cancellation-reminders', run: sendCancellationReminders },
  { name: 'usage', run: collectUsage },
  { name: 'health', run: checkHealth },
  { name: 'cleanup', run: cleanup },
];

export async function runMaintenance(ctx: Ctx): Promise<MaintenanceReport> {
  const tasks: MaintenanceReport['tasks'] = [];
  for (const task of TASKS) {
    try {
      tasks.push({ task: task.name, ok: true, detail: await task.run(ctx) });
    } catch (err) {
      ctx.log.error('Maintenance task failed', { task: task.name, error: errorMessage(err) });
      tasks.push({ task: task.name, ok: false, detail: errorMessage(err) });
    }
  }
  return { tasks };
}

export function startScheduler(ctx: Ctx, intervalSeconds: number): () => void {
  let running = false;
  const tick = async () => {
    // Without the Immich admin keys most tasks cannot work; wait for the first-start setup.
    if (running || Object.values(ctx.readiness).some((state) => state !== 'ready')) return;
    running = true;
    try {
      await runMaintenance(ctx);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalSeconds * 1000);
  void tick();
  return () => clearInterval(timer);
}

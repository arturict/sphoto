import type { InstanceName } from '@sphoto/shared';
import type { Billing } from './billing/billing';
import type { Clock } from './clock';
import type { Config } from './config';
import type { Db } from './db';
import type { ImmichGateway, ImmichUsage } from './immich/gateway';
import { errorMessage, type Logger } from './log';
import type { Mailer } from './mail/mailer';
import { JobRepo, NoticeRepo, RateLimiter } from './repos';
import { UserRepo } from './users';

// Tracks fire-and-forget work (migrations, exports) so errors are logged and tests can wait for it.
export class Background {
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly log: Logger) {}

  run(name: string, work: () => Promise<void>): void {
    const promise = work()
      .catch((err: unknown) => this.log.error(`Background task ${name} failed`, { error: errorMessage(err) }))
      .finally(() => this.pending.delete(promise));
    this.pending.add(promise);
  }

  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }
}

export interface Ctx {
  config: Config;
  db: Db;
  clock: Clock;
  log: Logger;
  immich: ImmichGateway;
  mailer: Mailer;
  billing: Billing;
  users: UserRepo;
  jobs: JobRepo;
  notices: NoticeRepo;
  rate: RateLimiter;
  background: Background;
  usageCache: UsageCache;
}

const USAGE_TTL_MS = 30_000;

// `statistics` walks the whole library table on Immich, so portal page loads share one reading.
export class UsageCache {
  private readonly entries = new Map<InstanceName, { at: number; usage: Map<string, ImmichUsage> }>();

  constructor(
    private readonly immich: ImmichGateway,
    private readonly clock: Clock,
  ) {}

  async get(instance: InstanceName, options: { fresh?: boolean } = {}): Promise<Map<string, ImmichUsage>> {
    const cached = this.entries.get(instance);
    const now = this.clock().getTime();
    if (!options.fresh && cached && now - cached.at < USAGE_TTL_MS) return cached.usage;
    const usage = new Map((await this.immich.usage(instance)).map((u) => [u.immichUserId, u]));
    this.entries.set(instance, { at: now, usage });
    return usage;
  }

  invalidate(instance: InstanceName): void {
    this.entries.delete(instance);
  }
}

export interface Deps {
  config: Config;
  db: Db;
  clock: Clock;
  log: Logger;
  immich: ImmichGateway;
  mailer: Mailer;
  billing: Billing;
}

export function createCtx(deps: Deps): Ctx {
  return {
    ...deps,
    users: new UserRepo(deps.db),
    jobs: new JobRepo(deps.db, deps.clock),
    notices: new NoticeRepo(deps.db, deps.clock),
    rate: new RateLimiter(deps.db, deps.clock),
    background: new Background(deps.log),
    usageCache: new UsageCache(deps.immich, deps.clock),
  };
}

/** Sends a mail without letting a delivery problem break the surrounding workflow. */
export async function sendMailSafely(ctx: Ctx, mail: Parameters<Mailer['send']>[0]): Promise<boolean> {
  try {
    await ctx.mailer.send(mail);
    return true;
  } catch (err) {
    ctx.log.error('Sending mail failed', { to: mail.to, subject: mail.subject, error: errorMessage(err) });
    return false;
  }
}

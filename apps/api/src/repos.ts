import { jobKindSchema, jobStatusSchema, type JobInfo } from '@sphoto/shared';
import { z } from 'zod';
import type { Clock } from './clock';
import type { Db } from './db';

const jobRowSchema = z.object({
  id: z.string(),
  kind: jobKindSchema,
  userId: z.string(),
  status: jobStatusSchema,
  done: z.number(),
  total: z.number(),
  error: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type JobRow = z.infer<typeof jobRowSchema>;

const JOB_COLUMNS = 'id, kind, user_id AS userId, status, done, total, error, created_at AS createdAt, finished_at AS finishedAt';

export const toJobInfo = (job: JobRow): JobInfo => ({
  id: job.id,
  kind: job.kind,
  status: job.status,
  done: job.done,
  total: job.total,
  error: job.error,
  createdAt: job.createdAt,
  finishedAt: job.finishedAt,
});

export class JobRepo {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  create(kind: JobRow['kind'], userId: string): JobRow {
    const id = crypto.randomUUID();
    this.db.run(
      "INSERT INTO jobs (id, kind, user_id, status, created_at) VALUES (?, ?, ?, 'running', ?)",
      id,
      kind,
      userId,
      this.clock().toISOString(),
    );
    return this.require(id);
  }

  require(id: string): JobRow {
    const job = this.db.get(jobRowSchema, `SELECT ${JOB_COLUMNS} FROM jobs WHERE id = ?`, id);
    if (!job) throw new Error(`Job ${id} not found`);
    return job;
  }

  progress(id: string, done: number, total: number): void {
    this.db.run('UPDATE jobs SET done = ?, total = ? WHERE id = ?', done, total, id);
  }

  succeed(id: string): void {
    this.db.run("UPDATE jobs SET status = 'succeeded', finished_at = ?, error = NULL WHERE id = ?", this.clock().toISOString(), id);
  }

  fail(id: string, error: string): void {
    this.db.run("UPDATE jobs SET status = 'failed', finished_at = ?, error = ? WHERE id = ?", this.clock().toISOString(), error, id);
  }

  latestForUser(userId: string): JobRow | undefined {
    return this.db.get(
      jobRowSchema,
      `SELECT ${JOB_COLUMNS} FROM jobs WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`,
      userId,
    );
  }

  listForUser(userId: string): JobRow[] {
    return this.db.all(jobRowSchema, `SELECT ${JOB_COLUMNS} FROM jobs WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 20`, userId);
  }

  listRecent(limit = 50): (JobRow & { userEmail: string | null })[] {
    return this.db.all(
      jobRowSchema.extend({ userEmail: z.string().nullable() }),
      `SELECT j.id, j.kind, j.user_id AS userId, j.status, j.done, j.total, j.error, j.created_at AS createdAt,
              j.finished_at AS finishedAt, u.email AS userEmail
       FROM jobs j LEFT JOIN users u ON u.id = j.user_id ORDER BY j.created_at DESC, j.rowid DESC LIMIT ?`,
      limit,
    );
  }

  countFailedSince(since: string): number {
    return this.db.get(z.object({ n: z.number() }), "SELECT COUNT(*) AS n FROM jobs WHERE status = 'failed' AND created_at >= ?", since)?.n ?? 0;
  }

  // A restart interrupts in-process jobs. Mark them failed so the user can retry.
  failInterrupted(): number {
    return this.db.run(
      "UPDATE jobs SET status = 'failed', finished_at = ?, error = 'Unterbrochen durch Neustart des Servers' WHERE status IN ('queued','running')",
      this.clock().toISOString(),
    ).changes;
  }
}

// "Mail this once" ledger. `scope` is a user id or an instance name.
export class NoticeRepo {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  has(scope: string, kind: string): boolean {
    return this.db.get(z.object({ n: z.number() }), 'SELECT COUNT(*) AS n FROM notices WHERE scope = ? AND kind = ?', scope, kind)?.n === 1;
  }

  mark(scope: string, kind: string): void {
    this.db.run('INSERT OR REPLACE INTO notices (scope, kind, sent_at) VALUES (?, ?, ?)', scope, kind, this.clock().toISOString());
  }

  clear(scope: string, kind: string): void {
    this.db.run('DELETE FROM notices WHERE scope = ? AND kind = ?', scope, kind);
  }

  clearScope(scope: string, kindPrefix: string): void {
    this.db.run("DELETE FROM notices WHERE scope = ? AND kind LIKE ? || '%'", scope, kindPrefix);
  }
}

export class RateLimiter {
  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
  ) {}

  // Records an event and reports whether `key` is still within `limit` events per `windowMs`.
  allow(key: string, limit: number, windowMs: number): boolean {
    const now = this.clock();
    const since = new Date(now.getTime() - windowMs).toISOString();
    this.db.run('DELETE FROM rate_events WHERE at < ?', since);
    const used = this.db.get(z.object({ n: z.number() }), 'SELECT COUNT(*) AS n FROM rate_events WHERE key = ? AND at >= ?', key, since)?.n ?? 0;
    if (used >= limit) return false;
    this.db.run('INSERT INTO rate_events (key, at) VALUES (?, ?)', key, now.toISOString());
    return true;
  }
}

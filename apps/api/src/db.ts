import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { z } from 'zod';

export type Param = SQLInputValue;

// Thin typed wrapper around node:sqlite. Every row that leaves the database is parsed
// with a zod schema, so row types are checked at runtime instead of cast.
export class Db {
  private txDepth = 0;

  private constructor(readonly raw: DatabaseSync) {}

  static open(path: string): Db {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    const raw = new DatabaseSync(path);
    raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    const db = new Db(raw);
    db.migrate();
    return db;
  }

  run(sql: string, ...params: Param[]): { changes: number } {
    const result = this.raw.prepare(sql).run(...params);
    return { changes: Number(result.changes) };
  }

  get<S extends z.ZodType>(schema: S, sql: string, ...params: Param[]): z.infer<S> | undefined {
    const row = this.raw.prepare(sql).get(...params);
    return row === undefined ? undefined : schema.parse(row);
  }

  all<S extends z.ZodType>(schema: S, sql: string, ...params: Param[]): z.infer<S>[] {
    return this.raw
      .prepare(sql)
      .all(...params)
      .map((row) => schema.parse(row));
  }

  // Synchronous transaction; nested calls join the outer one.
  transaction<T>(fn: () => T): T {
    if (this.txDepth > 0) return fn();
    this.raw.exec('BEGIN IMMEDIATE');
    this.txDepth++;
    try {
      const result = fn();
      this.raw.exec('COMMIT');
      return result;
    } catch (err) {
      this.raw.exec('ROLLBACK');
      throw err;
    } finally {
      this.txDepth--;
    }
  }

  close(): void {
    this.raw.close();
  }

  private migrate(): void {
    const current = Number(this.raw.prepare('PRAGMA user_version').get()?.['user_version'] ?? 0);
    for (let version = current; version < MIGRATIONS.length; version++) {
      const sql = MIGRATIONS[version];
      if (sql === undefined) throw new Error(`Missing migration ${version}`);
      this.transaction(() => {
        this.raw.exec(sql);
        this.raw.exec(`PRAGMA user_version = ${version + 1}`);
      });
    }
  }
}

// Append-only. Each entry runs once, in order.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('free','basic','pro')),
    instance TEXT NOT NULL CHECK (instance IN ('free','paid')),
    status TEXT NOT NULL CHECK (status IN ('active','migrating','deleted')),
    immich_user_id TEXT,
    immich_api_key TEXT,
    quota_gb REAL NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TEXT NOT NULL,
    deletion_due_at TEXT,
    cancellation_due_at TEXT,
    last_export_at TEXT
  );
  CREATE UNIQUE INDEX users_email_live ON users(email) WHERE status != 'deleted';
  CREATE INDEX users_stripe_customer ON users(stripe_customer_id);

  CREATE TABLE magic_links (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE checkout_sessions (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('basic','pro')),
    status TEXT NOT NULL CHECK (status IN ('pending','processing','complete','error')),
    message TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE webhook_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    received_at TEXT NOT NULL
  );

  CREATE TABLE instances (
    name TEXT PRIMARY KEY CHECK (name IN ('free','paid')),
    admin_api_key TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('upgrade','downgrade','export')),
    user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')),
    done INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
  );
  CREATE INDEX jobs_user ON jobs(user_id, created_at);

  CREATE TABLE exports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    removed_at TEXT
  );

  CREATE TABLE export_parts (
    export_id TEXT NOT NULL REFERENCES exports(id),
    idx INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    PRIMARY KEY (export_id, idx)
  );

  CREATE TABLE usage_snapshots (
    date TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    bytes INTEGER NOT NULL,
    photos INTEGER NOT NULL,
    videos INTEGER NOT NULL,
    PRIMARY KEY (date, user_id)
  );

  CREATE TABLE health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance TEXT NOT NULL,
    ok INTEGER NOT NULL,
    latency_ms INTEGER,
    error TEXT,
    checked_at TEXT NOT NULL
  );
  CREATE INDEX health_checks_instance ON health_checks(instance, id);

  -- One row per notice already sent, so a task that runs every few minutes mails once.
  CREATE TABLE notices (
    scope TEXT NOT NULL,
    kind TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    PRIMARY KEY (scope, kind)
  );

  CREATE TABLE rate_events (
    key TEXT NOT NULL,
    at TEXT NOT NULL
  );
  CREATE INDEX rate_events_key ON rate_events(key, at);
  `,
];

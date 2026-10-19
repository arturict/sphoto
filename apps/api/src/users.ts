import { instanceNameSchema, tierSchema, userStatusSchema, type InstanceName, type Tier } from '@sphoto/shared';
import { z } from 'zod';
import type { Db, Param } from './db';

const userRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  tier: tierSchema,
  instance: instanceNameSchema,
  status: userStatusSchema,
  immichUserId: z.string().nullable(),
  immichApiKey: z.string().nullable(),
  quotaGb: z.number(),
  stripeCustomerId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  createdAt: z.string(),
  deletionDueAt: z.string().nullable(),
  cancellationDueAt: z.string().nullable(),
  lastExportAt: z.string().nullable(),
});
export type User = z.infer<typeof userRowSchema>;

const COLUMNS = `id, email, tier, instance, status,
  immich_user_id AS immichUserId, immich_api_key AS immichApiKey, quota_gb AS quotaGb,
  stripe_customer_id AS stripeCustomerId, stripe_subscription_id AS stripeSubscriptionId,
  created_at AS createdAt, deletion_due_at AS deletionDueAt, cancellation_due_at AS cancellationDueAt,
  last_export_at AS lastExportAt`;

const DB_COLUMN: Record<keyof User, string> = {
  id: 'id',
  email: 'email',
  tier: 'tier',
  instance: 'instance',
  status: 'status',
  immichUserId: 'immich_user_id',
  immichApiKey: 'immich_api_key',
  quotaGb: 'quota_gb',
  stripeCustomerId: 'stripe_customer_id',
  stripeSubscriptionId: 'stripe_subscription_id',
  createdAt: 'created_at',
  deletionDueAt: 'deletion_due_at',
  cancellationDueAt: 'cancellation_due_at',
  lastExportAt: 'last_export_at',
};

export type NewUser = Pick<User, 'id' | 'email' | 'tier' | 'instance' | 'immichUserId' | 'immichApiKey' | 'quotaGb' | 'createdAt'> &
  Partial<Pick<User, 'stripeCustomerId' | 'stripeSubscriptionId'>>;

export class UserRepo {
  constructor(private readonly db: Db) {}

  insert(user: NewUser): User {
    this.db.run(
      `INSERT INTO users (id, email, tier, instance, status, immich_user_id, immich_api_key, quota_gb,
         stripe_customer_id, stripe_subscription_id, created_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
      user.id,
      user.email,
      user.tier,
      user.instance,
      user.immichUserId,
      user.immichApiKey,
      user.quotaGb,
      user.stripeCustomerId ?? null,
      user.stripeSubscriptionId ?? null,
      user.createdAt,
    );
    return this.require(user.id);
  }

  get(id: string): User | undefined {
    return this.db.get(userRowSchema, `SELECT ${COLUMNS} FROM users WHERE id = ?`, id);
  }

  require(id: string): User {
    const user = this.get(id);
    if (!user) throw new Error(`User ${id} not found`);
    return user;
  }

  findLiveByEmail(email: string): User | undefined {
    return this.db.get(userRowSchema, `SELECT ${COLUMNS} FROM users WHERE email = ? AND status != 'deleted'`, email);
  }

  findByStripeCustomer(customerId: string): User | undefined {
    return this.db.get(
      userRowSchema,
      `SELECT ${COLUMNS} FROM users WHERE stripe_customer_id = ? AND status != 'deleted' ORDER BY created_at DESC LIMIT 1`,
      customerId,
    );
  }

  list(filter: { includeDeleted?: boolean } = {}): User[] {
    const where = filter.includeDeleted ? '' : "WHERE status != 'deleted'";
    return this.db.all(userRowSchema, `SELECT ${COLUMNS} FROM users ${where} ORDER BY created_at DESC`);
  }

  // Users whose date column is at or before `now`, among live users.
  dueFor(column: 'deletionDueAt' | 'cancellationDueAt', now: string): User[] {
    const col = DB_COLUMN[column];
    return this.db.all(
      userRowSchema,
      `SELECT ${COLUMNS} FROM users WHERE status = 'active' AND ${col} IS NOT NULL AND ${col} <= ? ORDER BY ${col}`,
      now,
    );
  }

  update(id: string, patch: Partial<Omit<User, 'id'>>): User {
    const entries = Object.entries(patch) as [keyof User, Param][];
    if (entries.length === 0) return this.require(id);
    const assignments = entries.map(([key]) => `${DB_COLUMN[key]} = ?`).join(', ');
    this.db.run(`UPDATE users SET ${assignments} WHERE id = ?`, ...entries.map(([, value]) => value), id);
    return this.require(id);
  }

  // Atomically moves an active user to `migrating`. Returns false if someone else got there first.
  beginMigration(id: string): boolean {
    return this.db.run("UPDATE users SET status = 'migrating' WHERE id = ? AND status = 'active'", id).changes === 1;
  }

  countByTier(): Record<Tier, number> {
    const rows = this.db.all(
      z.object({ tier: tierSchema, n: z.number() }),
      "SELECT tier, COUNT(*) AS n FROM users WHERE status != 'deleted' GROUP BY tier",
    );
    const counts: Record<Tier, number> = { free: 0, basic: 0, pro: 0 };
    for (const row of rows) counts[row.tier] = row.n;
    return counts;
  }

  countByInstance(instance: InstanceName): number {
    return (
      this.db.get(z.object({ n: z.number() }), "SELECT COUNT(*) AS n FROM users WHERE instance = ? AND status != 'deleted'", instance)
        ?.n ?? 0
    );
  }
}

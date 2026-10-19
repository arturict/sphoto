import { z } from 'zod';

// Contract between apps/api and apps/web. The API builds its responses from these
// types and the web client parses every response with the matching schema.

export const tierSchema = z.enum(['free', 'basic', 'pro']);
export type Tier = z.infer<typeof tierSchema>;

export const paidTierSchema = z.enum(['basic', 'pro']);
export type PaidTier = z.infer<typeof paidTierSchema>;

export const instanceNameSchema = z.enum(['free', 'paid']);
export type InstanceName = z.infer<typeof instanceNameSchema>;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Ungültige E-Mail-Adresse');

export const planSchema = z.object({
  id: tierSchema,
  name: z.string(),
  priceChfPerMonth: z.number(),
  storageGb: z.number(),
  hasMl: z.boolean(),
});
export type Plan = z.infer<typeof planSchema>;

export const publicConfigSchema = z.object({
  plans: z.array(planSchema),
  instances: z.object({ free: z.object({ url: z.string() }), paid: z.object({ url: z.string() }) }),
});
export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const errorSchema = z.object({ error: z.string() });

// --- signup and checkout -------------------------------------------------------

export const freeSignupRequestSchema = z.object({ email: emailSchema });
export const freeSignupResponseSchema = z.object({ instanceUrl: z.string() });

export const checkoutRequestSchema = z.object({ plan: paidTierSchema, email: emailSchema });
export const checkoutResponseSchema = z.object({ url: z.string() });

export const checkoutStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'complete', 'error']),
  message: z.string().nullable(),
  plan: tierSchema,
  instanceUrl: z.string().nullable(),
});
export type CheckoutStatus = z.infer<typeof checkoutStatusSchema>;

// --- portal ------------------------------------------------------------------

export const loginRequestSchema = z.object({ email: emailSchema });
export const sessionRequestSchema = z.object({ token: z.string().min(20).max(200) });

export const jobStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
export const jobKindSchema = z.enum(['upgrade', 'downgrade', 'export']);

export const jobInfoSchema = z.object({
  id: z.string(),
  kind: jobKindSchema,
  status: jobStatusSchema,
  done: z.number(),
  total: z.number(),
  error: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type JobInfo = z.infer<typeof jobInfoSchema>;

export const exportPartSchema = z.object({ index: z.number(), sizeBytes: z.number(), sha256: z.string() });
export const exportInfoSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  parts: z.array(exportPartSchema),
});
export type ExportInfo = z.infer<typeof exportInfoSchema>;

export const portalMeSchema = z.object({
  email: z.string(),
  tier: tierSchema,
  planName: z.string(),
  quotaGb: z.number(),
  // Null when the photo server could not be asked.
  usedBytes: z.number().nullable(),
  photos: z.number().nullable(),
  videos: z.number().nullable(),
  instanceUrl: z.string(),
  hasMl: z.boolean(),
  createdAt: z.string(),
  migrating: z.boolean(),
  deletionDueAt: z.string().nullable(),
  cancellationDueAt: z.string().nullable(),
  canUpgrade: z.boolean(),
  canManageBilling: z.boolean(),
  nextExportAt: z.string().nullable(),
  latestExport: exportInfoSchema.nullable(),
  latestJob: jobInfoSchema.nullable(),
});
export type PortalMe = z.infer<typeof portalMeSchema>;

export const upgradeRequestSchema = z.object({ plan: paidTierSchema });
export const urlResponseSchema = z.object({ url: z.string() });
export const okSchema = z.object({ ok: z.literal(true) });
export const exportStartedSchema = z.object({ jobId: z.string() });
export const deletionResponseSchema = z.object({ deletionDueAt: z.string() });

// --- admin -------------------------------------------------------------------

export const userStatusSchema = z.enum(['active', 'migrating', 'deleted']);

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  tier: tierSchema,
  instance: instanceNameSchema,
  status: userStatusSchema,
  quotaGb: z.number(),
  usedBytes: z.number().nullable(),
  createdAt: z.string(),
  deletionDueAt: z.string().nullable(),
  cancellationDueAt: z.string().nullable(),
  hasSubscription: z.boolean(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserDetailSchema = adminUserSchema.extend({
  stripeCustomerId: z.string().nullable(),
  jobs: z.array(jobInfoSchema),
});
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

export const adminSetTierRequestSchema = z.object({ tier: paidTierSchema });
export const adminDeleteRequestSchema = z.object({ confirmEmail: z.string() });

export const instanceHealthSchema = z.object({
  instance: instanceNameSchema,
  url: z.string(),
  ok: z.boolean().nullable(),
  latencyMs: z.number().nullable(),
  checkedAt: z.string().nullable(),
  error: z.string().nullable(),
  users: z.number(),
  usageBytes: z.number().nullable(),
  photos: z.number().nullable(),
  videos: z.number().nullable(),
});
export type InstanceHealth = z.infer<typeof instanceHealthSchema>;

export const adminOverviewSchema = z.object({
  users: z.object({ total: z.number(), free: z.number(), basic: z.number(), pro: z.number() }),
  mrrChf: z.number(),
  pendingDeletions: z.number(),
  pendingCancellations: z.number(),
  failedJobs: z.number(),
  instances: z.array(instanceHealthSchema),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const adminAnalyticsSchema = z.object({
  days: z.number(),
  signups: z.array(z.object({ date: z.string(), count: z.number() })),
  storage: z.array(z.object({ date: z.string(), bytes: z.number() })),
  topUsers: z.array(z.object({ userId: z.string(), email: z.string(), usageBytes: z.number() })),
});
export type AdminAnalytics = z.infer<typeof adminAnalyticsSchema>;

export const maintenanceReportSchema = z.object({
  tasks: z.array(z.object({ task: z.string(), ok: z.boolean(), detail: z.string() })),
});
export type MaintenanceReport = z.infer<typeof maintenanceReportSchema>;

export const adminUserListSchema = z.array(adminUserSchema);
export const adminJobListSchema = z.array(jobInfoSchema.extend({ userEmail: z.string().nullable() }));

// =============================================================================
// Shared Instance User Management
// =============================================================================
// Manages users on the 2 shared Immich instances (free + paid)

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type {
  SharedUser,
  SharedUserCreateResult,
  SharedUserMigrationResult,
  UserTier,
  ImmichUserResponse,
  ImmichUserCreateDto,
} from './types';
import { SHARED_INSTANCES, FREE_TIER, INSTANCES_DIR } from './config';

const USERS_DIR = join(INSTANCES_DIR, '_shared_users');

// Ensure users directory exists
if (!existsSync(USERS_DIR)) {
  mkdirSync(USERS_DIR, { recursive: true });
}

// =============================================================================
// Helper Functions
// =============================================================================

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateVisibleId(email: string): string {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

function getUserFilePath(visibleId: string): string {
  return join(USERS_DIR, `${visibleId}.json`);
}

function getInstanceConfig(instance: 'free' | 'paid') {
  return instance === 'free' ? SHARED_INSTANCES.free : SHARED_INSTANCES.paid;
}

function tierToInstance(tier: UserTier): 'free' | 'paid' {
  return tier === 'free' ? 'free' : 'paid';
}

function tierToQuotaGB(tier: UserTier, planStorageGB?: number): number {
  if (tier === 'free') return FREE_TIER.quotaGB;
  return planStorageGB || SHARED_INSTANCES.paid.defaultQuotaGB;
}

// =============================================================================
// Immich API Helpers
// =============================================================================

async function immichApiCall<T>(
  instance: 'free' | 'paid',
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const config = getInstanceConfig(instance);
  
  if (!config.apiKey) {
    return { ok: false, error: `No API key configured for ${instance} instance` };
  }

  try {
    const response = await fetch(`${config.internalUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Immich API error (${instance}): ${response.status} - ${errorText}`);
      return { ok: false, error: `${response.status}: ${errorText}` };
    }

    const data = await response.json() as T;
    return { ok: true, data };
  } catch (err) {
    console.error(`Immich API call failed (${instance}):`, err);
    return { ok: false, error: (err as Error).message };
  }
}

// =============================================================================
// User CRUD Operations
// =============================================================================

export async function createSharedUser(
  email: string,
  tier: UserTier,
  quotaGB?: number
): Promise<SharedUserCreateResult> {
  const instance = tierToInstance(tier);
  const config = getInstanceConfig(instance);
  const visibleId = generateVisibleId(email);
  const password = generatePassword();
  const quota = tierToQuotaGB(tier, quotaGB);
  const quotaBytes = BigInt(quota) * BigInt(1024) * BigInt(1024) * BigInt(1024);

  console.log(`Creating user ${email} on ${instance} instance with ${quota}GB quota`);

  // Create user in Immich
  const createDto: ImmichUserCreateDto = {
    email,
    password,
    name: email.split('@')[0],
    quotaSizeInBytes: Number(quotaBytes),
    shouldChangePassword: true,
  };

  const result = await immichApiCall<ImmichUserResponse>(
    instance,
    '/api/admin/users',
    {
      method: 'POST',
      body: JSON.stringify(createDto),
    }
  );

  if (!result.ok || !result.data) {
    return { success: false, error: result.error || 'Failed to create user in Immich' };
  }

  // Save user metadata
  const user: SharedUser = {
    id: crypto.randomUUID(),
    visibleId,
    email,
    immichUserId: result.data.id,
    tier,
    instance,
    quotaGB: quota,
    created: new Date().toISOString(),
    status: 'active',
  };

  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));
  console.log(`User ${email} created successfully on ${instance} instance`);

  return {
    success: true,
    user,
    password,
  };
}

export function getSharedUser(visibleId: string): SharedUser | null {
  const filePath = getUserFilePath(visibleId);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

export function getSharedUserByEmail(email: string): SharedUser | null {
  const users = listSharedUsers();
  return users.find(u => u.email === email) || null;
}

export function getSharedUserByImmichId(immichUserId: string): SharedUser | null {
  const users = listSharedUsers();
  return users.find(u => u.immichUserId === immichUserId) || null;
}

export function listSharedUsers(): SharedUser[] {
  if (!existsSync(USERS_DIR)) return [];
  
  return readdirSync(USERS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(USERS_DIR, f), 'utf-8')));
}

export async function updateSharedUserQuota(
  visibleId: string,
  newQuotaGB: number
): Promise<{ success: boolean; error?: string }> {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };

  const quotaBytes = BigInt(newQuotaGB) * BigInt(1024) * BigInt(1024) * BigInt(1024);

  const result = await immichApiCall<ImmichUserResponse>(
    user.instance,
    `/api/admin/users/${user.immichUserId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ quotaSizeInBytes: Number(quotaBytes) }),
    }
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  // Update local metadata
  user.quotaGB = newQuotaGB;
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));

  console.log(`Updated quota for ${user.email} to ${newQuotaGB}GB`);
  return { success: true };
}

export async function updateSharedUserTier(
  visibleId: string,
  newTier: UserTier,
  newQuotaGB?: number,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<{ success: boolean; error?: string }> {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };

  const quota = newQuotaGB || tierToQuotaGB(newTier);
  
  // Update quota in Immich
  const quotaResult = await updateSharedUserQuota(visibleId, quota);
  if (!quotaResult.success) return quotaResult;

  // Update local metadata
  user.tier = newTier;
  user.quotaGB = quota;
  if (stripeCustomerId) user.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId) user.stripeSubscriptionId = stripeSubscriptionId;
  
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));

  console.log(`Updated tier for ${user.email} to ${newTier}`);
  return { success: true };
}

export async function deleteSharedUser(
  visibleId: string,
  force = false
): Promise<{ success: boolean; error?: string }> {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };

  // Delete from Immich
  const result = await immichApiCall<void>(
    user.instance,
    `/api/admin/users/${user.immichUserId}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ force }),
    }
  );

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  // Mark as deleted (keep file for audit)
  user.status = 'deleted';
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));

  console.log(`Deleted user ${user.email} from ${user.instance} instance`);
  return { success: true };
}

// =============================================================================
// User Migration (Free <-> Paid)
// =============================================================================

export async function migrateUserBetweenInstances(
  visibleId: string,
  newTier: UserTier,
  newQuotaGB?: number
): Promise<SharedUserMigrationResult> {
  const user = getSharedUser(visibleId);
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  const newInstance = tierToInstance(newTier);
  
  // Check if migration is actually needed
  if (user.instance === newInstance) {
    // Just update tier and quota, no migration needed
    const result = await updateSharedUserTier(visibleId, newTier, newQuotaGB);
    return {
      success: result.success,
      message: result.success 
        ? 'Tier updated (no migration needed - same instance)' 
        : result.error || 'Failed to update tier',
    };
  }

  const oldInstance = user.instance;
  const quota = newQuotaGB || tierToQuotaGB(newTier);
  const password = generatePassword();

  console.log(`Migrating user ${user.email} from ${oldInstance} to ${newInstance}`);

  // Step 1: Create user on new instance
  const createDto: ImmichUserCreateDto = {
    email: user.email,
    password,
    name: user.email.split('@')[0],
    quotaSizeInBytes: Number(BigInt(quota) * BigInt(1024) * BigInt(1024) * BigInt(1024)),
    shouldChangePassword: true,
  };

  const createResult = await immichApiCall<ImmichUserResponse>(
    newInstance,
    '/api/admin/users',
    {
      method: 'POST',
      body: JSON.stringify(createDto),
    }
  );

  if (!createResult.ok || !createResult.data) {
    return {
      success: false,
      message: `Failed to create user on ${newInstance} instance: ${createResult.error}`,
    };
  }

  // Step 2: Delete user from old instance
  // Note: This deletes all their photos! They need to re-upload after migration.
  const deleteResult = await immichApiCall<void>(
    oldInstance,
    `/api/admin/users/${user.immichUserId}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ force: true }),
    }
  );

  if (!deleteResult.ok) {
    console.error(`Warning: Failed to delete user from ${oldInstance}: ${deleteResult.error}`);
    // Continue anyway - user is created on new instance
  }

  // Step 3: Update local metadata
  user.immichUserId = createResult.data.id;
  user.instance = newInstance;
  user.tier = newTier;
  user.quotaGB = quota;
  
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));

  console.log(`Migration complete for ${user.email}: ${oldInstance} -> ${newInstance}`);

  return {
    success: true,
    message: `User migrated successfully. New password required.`,
    oldInstance,
    newInstance,
  };
}

// =============================================================================
// User Statistics
// =============================================================================

export async function getSharedUserStats(visibleId: string): Promise<{
  success: boolean;
  stats?: {
    quotaGB: number;
    usedBytes: number;
    usedGB: number;
    percentUsed: number;
    photos: number;
    videos: number;
  };
  error?: string;
}> {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };

  const result = await immichApiCall<{
    images: number;
    videos: number;
    usage: number;
  }>(
    user.instance,
    `/api/admin/users/${user.immichUserId}/statistics`,
    { method: 'GET' }
  );

  if (!result.ok || !result.data) {
    return { success: false, error: result.error };
  }

  const quotaBytes = user.quotaGB * 1024 * 1024 * 1024;
  const usedBytes = result.data.usage;

  return {
    success: true,
    stats: {
      quotaGB: user.quotaGB,
      usedBytes,
      usedGB: Math.round(usedBytes / (1024 * 1024 * 1024) * 100) / 100,
      percentUsed: Math.round((usedBytes / quotaBytes) * 100),
      photos: result.data.images,
      videos: result.data.videos,
    },
  };
}

// =============================================================================
// Stripe Integration Helpers
// =============================================================================

export function updateSharedUserStripe(
  visibleId: string,
  stripeCustomerId: string,
  stripeSubscriptionId?: string
): boolean {
  const user = getSharedUser(visibleId);
  if (!user) return false;

  user.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId) {
    user.stripeSubscriptionId = stripeSubscriptionId;
  }
  
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));
  return true;
}

export function getSharedUserByStripeCustomer(stripeCustomerId: string): SharedUser | null {
  const users = listSharedUsers();
  return users.find(u => u.stripeCustomerId === stripeCustomerId) || null;
}

// =============================================================================
// Instance Health Check
// =============================================================================

export async function checkSharedInstanceHealth(instance: 'free' | 'paid'): Promise<{
  healthy: boolean;
  message?: string;
}> {
  const config = getInstanceConfig(instance);

  try {
    const response = await fetch(`${config.internalUrl}/api/server/ping`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return { healthy: true };
    }
    return { healthy: false, message: `HTTP ${response.status}` };
  } catch (err) {
    return { healthy: false, message: (err as Error).message };
  }
}

export async function getSharedInstanceStats(instance: 'free' | 'paid'): Promise<{
  success: boolean;
  stats?: {
    users: number;
    photos: number;
    videos: number;
    usageBytes: number;
  };
  error?: string;
}> {
  const result = await immichApiCall<{
    photos: number;
    videos: number;
    usage: number;
    usageByUser: Array<{ userId: string; usage: number }>;
  }>(instance, '/api/server/statistics', { method: 'GET' });

  if (!result.ok || !result.data) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    stats: {
      users: result.data.usageByUser.length,
      photos: result.data.photos,
      videos: result.data.videos,
      usageBytes: result.data.usage,
    },
  };
}

// =============================================================================
// Account Deletion with 2-Week Delay
// =============================================================================

const DELETION_DELAY_DAYS = 14;

export function requestAccountDeletion(visibleId: string): { 
  success: boolean; 
  scheduledFor?: string;
  error?: string;
} {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };
  
  if (user.status === 'pending_deletion') {
    return { 
      success: true, 
      scheduledFor: user.deletionScheduledFor,
    };
  }
  
  if (user.status === 'deleted') {
    return { success: false, error: 'Account already deleted' };
  }

  const now = new Date();
  const scheduledFor = new Date(now.getTime() + DELETION_DELAY_DAYS * 24 * 60 * 60 * 1000);

  user.status = 'pending_deletion';
  user.deletionRequestedAt = now.toISOString();
  user.deletionScheduledFor = scheduledFor.toISOString();
  
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));
  
  console.log(`Account deletion scheduled for ${user.email} on ${scheduledFor.toISOString()}`);
  
  return {
    success: true,
    scheduledFor: scheduledFor.toISOString(),
  };
}

export function cancelAccountDeletion(visibleId: string): { 
  success: boolean; 
  error?: string;
} {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };
  
  if (user.status !== 'pending_deletion') {
    return { success: false, error: 'Account is not pending deletion' };
  }

  user.status = 'active';
  delete user.deletionRequestedAt;
  delete user.deletionScheduledFor;
  
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));
  
  console.log(`Account deletion cancelled for ${user.email}`);
  
  return { success: true };
}

export async function processScheduledDeletions(): Promise<{
  processed: number;
  deleted: string[];
  errors: string[];
}> {
  const users = listSharedUsers();
  const now = new Date();
  const deleted: string[] = [];
  const errors: string[] = [];

  for (const user of users) {
    if (user.status !== 'pending_deletion' || !user.deletionScheduledFor) {
      continue;
    }

    const scheduledDate = new Date(user.deletionScheduledFor);
    if (scheduledDate > now) {
      continue; // Not time yet
    }

    console.log(`Processing scheduled deletion for ${user.email}`);
    
    const result = await deleteSharedUser(user.visibleId, true);
    if (result.success) {
      deleted.push(user.email);
    } else {
      errors.push(`${user.email}: ${result.error}`);
    }
  }

  return {
    processed: deleted.length + errors.length,
    deleted,
    errors,
  };
}

export function listPendingDeletions(): SharedUser[] {
  return listSharedUsers().filter(u => u.status === 'pending_deletion');
}

// =============================================================================
// Portal Authentication
// =============================================================================

function generatePortalToken(): string {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
}

export function createPortalSession(visibleId: string): {
  success: boolean;
  token?: string;
  expiresAt?: string;
  error?: string;
} {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };
  
  if (user.status === 'deleted') {
    return { success: false, error: 'Account is deleted' };
  }

  const token = generatePortalToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  user.portalToken = token;
  user.portalTokenExpiresAt = expiresAt.toISOString();
  
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));

  return {
    success: true,
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

export function validatePortalToken(token: string): SharedUser | null {
  const users = listSharedUsers();
  
  for (const user of users) {
    if (user.portalToken === token) {
      if (user.portalTokenExpiresAt && new Date(user.portalTokenExpiresAt) < new Date()) {
        return null; // Token expired
      }
      return user;
    }
  }
  
  return null;
}

export function invalidatePortalToken(visibleId: string): boolean {
  const user = getSharedUser(visibleId);
  if (!user) return false;

  delete user.portalToken;
  delete user.portalTokenExpiresAt;
  
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));
  return true;
}

// =============================================================================
// Portal Data (for user-facing dashboard)
// =============================================================================

export async function getPortalData(visibleId: string): Promise<{
  success: boolean;
  data?: {
    email: string;
    tier: string;
    plan: string;
    quotaGB: number;
    usedGB: number;
    percentUsed: number;
    photos: number;
    videos: number;
    instance: 'free' | 'paid';
    instanceUrl: string;
    hasML: boolean;
    status: string;
    created: string;
    isPendingDeletion: boolean;
    deletionScheduledFor?: string;
    canRequestExport: boolean;
    lastExportAt?: string;
  };
  error?: string;
}> {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };

  const config = user.instance === 'free' ? SHARED_INSTANCES.free : SHARED_INSTANCES.paid;
  
  // Get storage stats
  const statsResult = await getSharedUserStats(visibleId);
  
  // Check export eligibility (once per month)
  const canRequestExport = !user.lastExportAt || 
    (new Date().getTime() - new Date(user.lastExportAt).getTime()) > 30 * 24 * 60 * 60 * 1000;

  // Map tier to display name
  const planNames: Record<string, string> = {
    free: 'Free',
    basic: 'Basic',
    pro: 'Pro',
  };

  return {
    success: true,
    data: {
      email: user.email,
      tier: user.tier,
      plan: planNames[user.tier] || user.tier,
      quotaGB: user.quotaGB,
      usedGB: statsResult.stats?.usedGB || 0,
      percentUsed: statsResult.stats?.percentUsed || 0,
      photos: statsResult.stats?.photos || 0,
      videos: statsResult.stats?.videos || 0,
      instance: user.instance,
      instanceUrl: config.url,
      hasML: config.hasML,
      status: user.status,
      created: user.created,
      isPendingDeletion: user.status === 'pending_deletion',
      deletionScheduledFor: user.deletionScheduledFor,
      canRequestExport,
      lastExportAt: user.lastExportAt,
    },
  };
}

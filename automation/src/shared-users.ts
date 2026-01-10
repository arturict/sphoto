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

export async function immichApiCall<T>(
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
    // Parse the error to provide better messages
    const errorMsg = result.error || 'Failed to create user in Immich';
    
    // Check for common errors and return user-friendly messages
    if (errorMsg.includes('User exists') || errorMsg.includes('already exists')) {
      return { success: false, error: 'Diese E-Mail-Adresse ist bereits registriert.' };
    }
    if (errorMsg.includes('Invalid email')) {
      return { success: false, error: 'Ungültige E-Mail-Adresse.' };
    }
    
    return { success: false, error: errorMsg };
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

export function getSharedUserByEmail(email: string, includeDeleted = false): SharedUser | null {
  const users = listSharedUsers();
  return users.find(u => u.email === email && (includeDeleted || u.status !== 'deleted')) || null;
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

/**
 * Completely purge a user - removes from Immich AND deletes local JSON file.
 * Used by the nuke endpoint for clean testing.
 */
export async function purgeSharedUser(
  visibleId: string
): Promise<{ success: boolean; error?: string }> {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };

  // Try to delete from Immich (ignore errors - user might already be deleted)
  if (user.status !== 'deleted') {
    const result = await immichApiCall<void>(
      user.instance,
      `/api/admin/users/${user.immichUserId}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ force: true }),
      }
    );

    if (!result.ok) {
      console.log(`Warning: Could not delete ${user.email} from Immich: ${result.error}`);
      // Continue anyway - we'll still remove the local file
    }
  }

  // Remove the local JSON file entirely
  const filePath = getUserFilePath(visibleId);
  if (existsSync(filePath)) {
    const { unlinkSync } = await import('fs');
    unlinkSync(filePath);
    console.log(`Purged user file for ${user.email}`);
  }

  return { success: true };
}

// =============================================================================
// User Migration (Free <-> Paid)
// =============================================================================

// Types for photo migration
interface ImmichAsset {
  id: string;
  originalFileName: string;
  originalPath: string;
  type: 'IMAGE' | 'VIDEO';
  fileCreatedAt: string;
  fileModifiedAt: string;
  checksum: string;
}

interface ImmichAlbum {
  id: string;
  albumName: string;
  description?: string;
  createdAt: string;
  assets: Array<{ id: string }>;
}

interface PhotoMigrationResult {
  success: boolean;
  totalAssets: number;
  migratedAssets: number;
  failedAssets: number;
  albums: {
    total: number;
    migrated: number;
  };
  errors: string[];
}

/**
 * Downloads an asset's original file from an Immich instance.
 * Returns the file as a Buffer for re-uploading.
 */
async function downloadAssetOriginal(
  instance: 'free' | 'paid',
  assetId: string
): Promise<{ ok: boolean; buffer?: Buffer; error?: string }> {
  const config = getInstanceConfig(instance);
  
  if (!config.apiKey) {
    return { ok: false, error: 'No API key' };
  }

  try {
    const response = await fetch(`${config.internalUrl}/api/assets/${assetId}/original`, {
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return { ok: true, buffer };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Uploads an asset to an Immich instance using multipart form data.
 * Returns the new asset ID on success.
 */
async function uploadAssetToInstance(
  instance: 'free' | 'paid',
  targetUserId: string,
  buffer: Buffer,
  filename: string,
  fileCreatedAt: string,
  assetType: 'IMAGE' | 'VIDEO'
): Promise<{ ok: boolean; assetId?: string; error?: string }> {
  const config = getInstanceConfig(instance);
  
  if (!config.apiKey) {
    return { ok: false, error: 'No API key' };
  }

  try {
    // Create form data for multipart upload
    const formData = new FormData();
    
    // Determine MIME type from filename
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
    };
    const mimeType = mimeTypes[ext] || (assetType === 'VIDEO' ? 'video/mp4' : 'image/jpeg');
    
    // Create a Blob from the buffer
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('assetData', blob, filename);
    
    // Add required metadata
    formData.append('deviceAssetId', `migration-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    formData.append('deviceId', 'sphoto-migration');
    formData.append('fileCreatedAt', fileCreatedAt);
    formData.append('fileModifiedAt', fileCreatedAt);

    const response = await fetch(`${config.internalUrl}/api/assets`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        // Note: Don't set Content-Type for FormData, browser/fetch sets it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json() as { id: string };
    return { ok: true, assetId: result.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Migrates all photos/videos from one Immich instance to another.
 * This is used during tier upgrades (free -> paid) to preserve user data.
 * 
 * Process:
 * 1. Fetch all assets from source instance (paginated)
 * 2. Download each asset's original file
 * 3. Upload to target instance
 * 4. Migrate albums (create on target, add migrated assets)
 * 
 * @param sourceInstance - 'free' or 'paid'
 * @param targetInstance - 'free' or 'paid' (opposite of source)
 * @param sourceUserId - Immich user ID on source instance
 * @param targetUserId - Immich user ID on target instance (must already exist)
 */
export async function migrateUserPhotosToNewInstance(
  sourceInstance: 'free' | 'paid',
  targetInstance: 'free' | 'paid',
  sourceUserId: string,
  targetUserId: string
): Promise<PhotoMigrationResult> {
  const result: PhotoMigrationResult = {
    success: false,
    totalAssets: 0,
    migratedAssets: 0,
    failedAssets: 0,
    albums: { total: 0, migrated: 0 },
    errors: [],
  };

  console.log(`[Migration] Starting photo migration from ${sourceInstance} to ${targetInstance}`);
  console.log(`[Migration] Source user: ${sourceUserId}, Target user: ${targetUserId}`);

  // Map of old asset ID -> new asset ID (for album migration)
  const assetIdMap = new Map<string, string>();

  // Step 1: Fetch all assets with pagination
  const PAGE_SIZE = 1000;
  let allAssets: ImmichAsset[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const searchResult = await immichApiCall<{ assets: { items: ImmichAsset[]; nextPage: string | null } }>(
      sourceInstance,
      '/api/search/metadata',
      {
        method: 'POST',
        body: JSON.stringify({
          ownerId: sourceUserId,
          size: PAGE_SIZE,
          page,
        }),
      }
    );

    if (!searchResult.ok || !searchResult.data) {
      result.errors.push(`Failed to fetch assets page ${page}: ${searchResult.error}`);
      return result;
    }

    const pageAssets = searchResult.data.assets.items;
    allAssets = allAssets.concat(pageAssets);
    
    console.log(`[Migration] Page ${page}: fetched ${pageAssets.length} assets (total: ${allAssets.length})`);

    if (pageAssets.length < PAGE_SIZE || searchResult.data.assets.nextPage === null) {
      hasMore = false;
    } else {
      page++;
    }
  }

  result.totalAssets = allAssets.length;
  console.log(`[Migration] Found ${allAssets.length} total assets to migrate`);

  if (allAssets.length === 0) {
    result.success = true;
    console.log('[Migration] No assets to migrate - completing successfully');
    return result;
  }

  // Step 2: Download and upload each asset
  for (let i = 0; i < allAssets.length; i++) {
    const asset = allAssets[i];
    
    // Download from source
    const downloadResult = await downloadAssetOriginal(sourceInstance, asset.id);
    if (!downloadResult.ok || !downloadResult.buffer) {
      result.failedAssets++;
      result.errors.push(`Download failed for ${asset.originalFileName}: ${downloadResult.error}`);
      console.log(`[Migration] Failed to download ${asset.originalFileName}: ${downloadResult.error}`);
      continue;
    }

    // Upload to target
    const uploadResult = await uploadAssetToInstance(
      targetInstance,
      targetUserId,
      downloadResult.buffer,
      asset.originalFileName,
      asset.fileCreatedAt,
      asset.type
    );

    if (!uploadResult.ok || !uploadResult.assetId) {
      result.failedAssets++;
      result.errors.push(`Upload failed for ${asset.originalFileName}: ${uploadResult.error}`);
      console.log(`[Migration] Failed to upload ${asset.originalFileName}: ${uploadResult.error}`);
      continue;
    }

    // Track mapping for album migration
    assetIdMap.set(asset.id, uploadResult.assetId);
    result.migratedAssets++;

    // Log progress every 25 files or at the end
    if ((i + 1) % 25 === 0 || i + 1 === allAssets.length) {
      console.log(`[Migration] Progress: ${i + 1}/${allAssets.length} assets (${result.migratedAssets} successful, ${result.failedAssets} failed)`);
    }
  }

  // Step 3: Migrate albums
  console.log('[Migration] Fetching albums...');
  const albumsResult = await immichApiCall<ImmichAlbum[]>(
    sourceInstance,
    `/api/albums?userId=${sourceUserId}`,
    { method: 'GET' }
  );

  if (albumsResult.ok && albumsResult.data && albumsResult.data.length > 0) {
    result.albums.total = albumsResult.data.length;
    console.log(`[Migration] Found ${albumsResult.data.length} albums to migrate`);

    for (const album of albumsResult.data) {
      // Create album on target instance
      const createAlbumResult = await immichApiCall<{ id: string }>(
        targetInstance,
        '/api/albums',
        {
          method: 'POST',
          body: JSON.stringify({
            albumName: album.albumName,
            description: album.description || '',
          }),
        }
      );

      if (!createAlbumResult.ok || !createAlbumResult.data) {
        result.errors.push(`Failed to create album "${album.albumName}": ${createAlbumResult.error}`);
        continue;
      }

      const newAlbumId = createAlbumResult.data.id;

      // Map old asset IDs to new ones
      const newAssetIds = album.assets
        .map(a => assetIdMap.get(a.id))
        .filter((id): id is string => id !== undefined);

      if (newAssetIds.length > 0) {
        // Add assets to the album
        const addAssetsResult = await immichApiCall<void>(
          targetInstance,
          `/api/albums/${newAlbumId}/assets`,
          {
            method: 'PUT',
            body: JSON.stringify({ ids: newAssetIds }),
          }
        );

        if (!addAssetsResult.ok) {
          result.errors.push(`Failed to add assets to album "${album.albumName}": ${addAssetsResult.error}`);
        }
      }

      result.albums.migrated++;
      console.log(`[Migration] Migrated album "${album.albumName}" with ${newAssetIds.length} assets`);
    }
  }

  // Determine overall success (allow partial success if at least 50% migrated)
  const successRate = result.totalAssets > 0 ? result.migratedAssets / result.totalAssets : 1;
  result.success = successRate >= 0.5;

  console.log(`[Migration] Completed: ${result.migratedAssets}/${result.totalAssets} assets, ${result.albums.migrated}/${result.albums.total} albums`);
  if (result.errors.length > 0) {
    console.log(`[Migration] Errors (${result.errors.length}): ${result.errors.slice(0, 5).join('; ')}${result.errors.length > 5 ? '...' : ''}`);
  }

  return result;
}

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
  const oldImmichUserId = user.immichUserId;
  const quota = newQuotaGB || tierToQuotaGB(newTier);
  const password = generatePassword();

  console.log(`[Migration] Starting migration for ${user.email} from ${oldInstance} to ${newInstance}`);

  // Step 1: Create user on new instance FIRST
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

  const newImmichUserId = createResult.data.id;
  console.log(`[Migration] Created user on ${newInstance} with ID ${newImmichUserId}`);

  // Step 2: Migrate photos from old instance to new instance
  const photoMigration = await migrateUserPhotosToNewInstance(
    oldInstance,
    newInstance,
    oldImmichUserId,
    newImmichUserId
  );

  if (!photoMigration.success) {
    // Photo migration failed - but user is already created on new instance
    // We should NOT delete the old user in this case, to prevent data loss
    console.error(`[Migration] Photo migration failed for ${user.email}: ${photoMigration.errors.join(', ')}`);
    
    // Clean up the newly created user on target since migration failed
    await immichApiCall<void>(
      newInstance,
      `/api/admin/users/${newImmichUserId}`,
      { method: 'DELETE', body: JSON.stringify({ force: true }) }
    );

    return {
      success: false,
      message: `Photo migration failed: ${photoMigration.errors.slice(0, 3).join('; ')}`,
      migration: {
        totalAssets: photoMigration.totalAssets,
        migratedAssets: photoMigration.migratedAssets,
        failedAssets: photoMigration.failedAssets,
        albums: photoMigration.albums,
      },
    };
  }

  console.log(`[Migration] Photos migrated successfully: ${photoMigration.migratedAssets}/${photoMigration.totalAssets}`);

  // Step 3: Delete user from old instance ONLY after successful photo migration
  const deleteResult = await immichApiCall<void>(
    oldInstance,
    `/api/admin/users/${oldImmichUserId}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ force: true }),
    }
  );

  if (!deleteResult.ok) {
    console.error(`[Migration] Warning: Failed to delete user from ${oldInstance}: ${deleteResult.error}`);
    // Continue anyway - photos are safely migrated to new instance
  }

  // Step 4: Update local metadata
  user.immichUserId = newImmichUserId;
  user.instance = newInstance;
  user.tier = newTier;
  user.quotaGB = quota;
  
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));

  console.log(`[Migration] Complete for ${user.email}: ${oldInstance} -> ${newInstance}`);

  return {
    success: true,
    message: `Migration successful! ${photoMigration.migratedAssets} photos/videos transferred.`,
    oldInstance,
    newInstance,
    password,
    migration: {
      totalAssets: photoMigration.totalAssets,
      migratedAssets: photoMigration.migratedAssets,
      failedAssets: photoMigration.failedAssets,
      albums: photoMigration.albums,
    },
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
// Subscription Cancellation with Grace Period
// =============================================================================

const CANCELLATION_GRACE_DAYS = 14;

export function scheduleSubscriptionCancellation(visibleId: string): { 
  success: boolean; 
  gracePeriodEnd?: string;
  error?: string;
} {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };
  
  if (user.status === 'deleted') {
    return { success: false, error: 'Account already deleted' };
  }
  
  // If already pending cancellation, return the existing date
  if (user.status === 'pending_cancellation' && user.cancellationGracePeriodEnd) {
    return { 
      success: true, 
      gracePeriodEnd: user.cancellationGracePeriodEnd,
    };
  }

  const now = new Date();
  const gracePeriodEnd = new Date(now.getTime() + CANCELLATION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  user.status = 'pending_cancellation';
  user.cancellationScheduledAt = now.toISOString();
  user.cancellationGracePeriodEnd = gracePeriodEnd.toISOString();
  // Clear Stripe IDs since subscription is cancelled
  delete user.stripeSubscriptionId;
  
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));
  
  console.log(`Subscription cancellation scheduled for ${user.email}, grace period ends ${gracePeriodEnd.toISOString()}`);
  
  return {
    success: true,
    gracePeriodEnd: gracePeriodEnd.toISOString(),
  };
}

export function cancelSubscriptionCancellation(visibleId: string): { 
  success: boolean; 
  error?: string;
} {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };
  
  if (user.status !== 'pending_cancellation') {
    return { success: false, error: 'Account is not pending cancellation' };
  }

  user.status = 'active';
  delete user.cancellationScheduledAt;
  delete user.cancellationGracePeriodEnd;
  
  writeFileSync(getUserFilePath(visibleId), JSON.stringify(user, null, 2));
  
  console.log(`Subscription cancellation cancelled for ${user.email}`);
  
  return { success: true };
}

export async function processScheduledCancellations(): Promise<{
  processed: number;
  migrated: string[];
  errors: string[];
}> {
  const users = listSharedUsers();
  const now = new Date();
  const migrated: string[] = [];
  const errors: string[] = [];

  for (const user of users) {
    if (user.status !== 'pending_cancellation' || !user.cancellationGracePeriodEnd) {
      continue;
    }

    const gracePeriodEnd = new Date(user.cancellationGracePeriodEnd);
    if (gracePeriodEnd > now) {
      continue; // Grace period not over yet
    }

    console.log(`Processing scheduled cancellation for ${user.email} - migrating to free tier`);
    
    // Migrate to free tier (this deletes all photos)
    const result = await migrateUserBetweenInstances(user.visibleId, 'free');
    
    if (result.success) {
      // Clear cancellation fields after successful migration
      const updatedUser = getSharedUser(user.visibleId);
      if (updatedUser) {
        updatedUser.status = 'active';
        delete updatedUser.cancellationScheduledAt;
        delete updatedUser.cancellationGracePeriodEnd;
        writeFileSync(getUserFilePath(user.visibleId), JSON.stringify(updatedUser, null, 2));
      }
      migrated.push(user.email);
    } else {
      errors.push(`${user.email}: ${result.message}`);
    }
  }

  return {
    processed: migrated.length + errors.length,
    migrated,
    errors,
  };
}

export function listPendingCancellations(): SharedUser[] {
  return listSharedUsers().filter(u => u.status === 'pending_cancellation');
}

export function getUsersNeedingCancellationReminder(daysRemaining: number): SharedUser[] {
  const now = new Date();
  const targetDate = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
  const dayStart = new Date(targetDate.setHours(0, 0, 0, 0));
  const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999));
  
  return listSharedUsers().filter(u => {
    if (u.status !== 'pending_cancellation' || !u.cancellationGracePeriodEnd) {
      return false;
    }
    const gracePeriodEnd = new Date(u.cancellationGracePeriodEnd);
    return gracePeriodEnd >= dayStart && gracePeriodEnd <= dayEnd;
  });
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

// =============================================================================
// Sync with Immich Instances
// =============================================================================

interface ImmichUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  quotaSizeInBytes: number | null;
  quotaUsageInBytes: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export async function syncWithImmich(): Promise<{
  success: boolean;
  synced: {
    free: { total: number; tracked: number; untracked: number; orphaned: number };
    paid: { total: number; tracked: number; untracked: number; orphaned: number };
  };
  untrackedUsers: Array<{ email: string; instance: 'free' | 'paid'; immichUserId: string }>;
  orphanedRecords: string[];
  error?: string;
}> {
  const localUsers = listSharedUsers();
  const orphanedRecords: string[] = [];
  const untrackedUsers: Array<{ email: string; instance: 'free' | 'paid'; immichUserId: string }> = [];

  const synced = {
    free: { total: 0, tracked: 0, untracked: 0, orphaned: 0 },
    paid: { total: 0, tracked: 0, untracked: 0, orphaned: 0 },
  };

  // Fetch users from both instances
  for (const instance of ['free', 'paid'] as const) {
    const result = await immichApiCall<ImmichUser[]>(instance, '/api/admin/users');
    
    if (!result.ok || !result.data) {
      return { 
        success: false, 
        synced, 
        untrackedUsers, 
        orphanedRecords,
        error: `Failed to fetch users from ${instance}: ${result.error}` 
      };
    }

    // Filter out admin users (we don't track those)
    const immichUsers = result.data.filter(u => !u.isAdmin && !u.deletedAt);
    synced[instance].total = immichUsers.length;

    // Check which Immich users are tracked locally
    for (const immichUser of immichUsers) {
      const localUser = localUsers.find(
        u => u.immichUserId === immichUser.id && u.instance === instance
      );
      
      if (localUser) {
        synced[instance].tracked++;
      } else {
        synced[instance].untracked++;
        untrackedUsers.push({
          email: immichUser.email,
          instance,
          immichUserId: immichUser.id,
        });
      }
    }

    // Check for orphaned local records (no matching Immich user)
    const instanceLocalUsers = localUsers.filter(u => u.instance === instance && u.status !== 'deleted');
    for (const localUser of instanceLocalUsers) {
      const immichUser = immichUsers.find(u => u.id === localUser.immichUserId);
      if (!immichUser) {
        synced[instance].orphaned++;
        orphanedRecords.push(localUser.visibleId);
      }
    }
  }

  return {
    success: true,
    synced,
    untrackedUsers,
    orphanedRecords,
  };
}

export async function importUntrackedUser(
  instance: 'free' | 'paid',
  immichUserId: string,
  tier: UserTier
): Promise<{ success: boolean; user?: SharedUser; error?: string }> {
  // Fetch user details from Immich
  const result = await immichApiCall<ImmichUser>(instance, `/api/admin/users/${immichUserId}`);
  
  if (!result.ok || !result.data) {
    return { success: false, error: `Failed to fetch user: ${result.error}` };
  }

  const immichUser = result.data;
  const quotaGB = immichUser.quotaSizeInBytes 
    ? Math.round(immichUser.quotaSizeInBytes / (1024 * 1024 * 1024))
    : tierToQuotaGB(tier);

  const user: SharedUser = {
    id: crypto.randomUUID(),
    visibleId: generateVisibleId(immichUser.email),
    email: immichUser.email,
    immichUserId: immichUser.id,
    tier,
    instance,
    quotaGB,
    created: immichUser.createdAt,
    status: 'active',
  };

  writeFileSync(getUserFilePath(user.visibleId), JSON.stringify(user, null, 2));
  console.log(`Imported untracked user ${user.email} from ${instance}`);

  return { success: true, user };
}

export async function cleanupOrphanedRecords(visibleIds: string[]): Promise<{
  success: boolean;
  cleaned: string[];
  errors: string[];
}> {
  const cleaned: string[] = [];
  const errors: string[] = [];

  for (const visibleId of visibleIds) {
    const filePath = getUserFilePath(visibleId);
    if (existsSync(filePath)) {
      try {
        const { unlinkSync } = await import('fs');
        unlinkSync(filePath);
        cleaned.push(visibleId);
        console.log(`Cleaned up orphaned record: ${visibleId}`);
      } catch (err) {
        errors.push(`${visibleId}: ${(err as Error).message}`);
      }
    }
  }

  return { success: errors.length === 0, cleaned, errors };
}

// =============================================================================
// Enhanced User Stats
// =============================================================================

export async function getEnhancedUserStats(visibleId: string): Promise<{
  success: boolean;
  stats?: {
    quotaGB: number;
    usedBytes: number;
    usedGB: number;
    percentUsed: number;
    photos: number;
    videos: number;
    lastActivity?: string;
    createdAt: string;
    averageFileSize?: number;
  };
  error?: string;
}> {
  const user = getSharedUser(visibleId);
  if (!user) return { success: false, error: 'User not found' };

  // Get user statistics
  const statsResult = await immichApiCall<{
    images: number;
    videos: number;
    usage: number;
  }>(user.instance, `/api/admin/users/${user.immichUserId}/statistics`);

  // Get user details for last activity
  const userResult = await immichApiCall<ImmichUser>(
    user.instance,
    `/api/admin/users/${user.immichUserId}`
  );

  if (!statsResult.ok || !statsResult.data) {
    return { success: false, error: statsResult.error };
  }

  const quotaBytes = user.quotaGB * 1024 * 1024 * 1024;
  const usedBytes = statsResult.data.usage;
  const totalFiles = statsResult.data.images + statsResult.data.videos;

  return {
    success: true,
    stats: {
      quotaGB: user.quotaGB,
      usedBytes,
      usedGB: Math.round(usedBytes / (1024 * 1024 * 1024) * 100) / 100,
      percentUsed: Math.round((usedBytes / quotaBytes) * 100),
      photos: statsResult.data.images,
      videos: statsResult.data.videos,
      lastActivity: userResult.data?.updatedAt,
      createdAt: user.created,
      averageFileSize: totalFiles > 0 ? Math.round(usedBytes / totalFiles) : 0,
    },
  };
}

// =============================================================================
// Bulk User Stats
// =============================================================================

export async function getAllUsersWithStats(): Promise<{
  success: boolean;
  users: Array<SharedUser & {
    stats?: {
      usedBytes: number;
      photos: number;
      videos: number;
      lastActivity?: string;
    };
    syncStatus: 'synced' | 'orphaned' | 'unknown';
  }>;
  error?: string;
}> {
  const localUsers = listSharedUsers().filter(u => u.status !== 'deleted');
  const usersWithStats: Array<SharedUser & {
    stats?: { usedBytes: number; photos: number; videos: number; lastActivity?: string };
    syncStatus: 'synced' | 'orphaned' | 'unknown';
  }> = [];

  // Fetch all Immich users to check sync status
  const freeUsersResult = await immichApiCall<ImmichUser[]>('free', '/api/admin/users');
  const paidUsersResult = await immichApiCall<ImmichUser[]>('paid', '/api/admin/users');

  const freeImmichIds = new Set(freeUsersResult.data?.map(u => u.id) || []);
  const paidImmichIds = new Set(paidUsersResult.data?.map(u => u.id) || []);

  for (const user of localUsers) {
    const immichIds = user.instance === 'free' ? freeImmichIds : paidImmichIds;
    const syncStatus = immichIds.has(user.immichUserId) ? 'synced' : 'orphaned';

    // Try to get stats (only if synced)
    let stats: { usedBytes: number; photos: number; videos: number; lastActivity?: string } | undefined;
    
    if (syncStatus === 'synced') {
      const statsResult = await immichApiCall<{
        images: number;
        videos: number;
        usage: number;
      }>(user.instance, `/api/admin/users/${user.immichUserId}/statistics`);

      if (statsResult.ok && statsResult.data) {
        const userResult = await immichApiCall<ImmichUser>(
          user.instance,
          `/api/admin/users/${user.immichUserId}`
        );

        stats = {
          usedBytes: statsResult.data.usage,
          photos: statsResult.data.images,
          videos: statsResult.data.videos,
          lastActivity: userResult.data?.updatedAt,
        };
      }
    }

    usersWithStats.push({
      ...user,
      stats,
      syncStatus,
    });
  }

  return { success: true, users: usersWithStats };
}


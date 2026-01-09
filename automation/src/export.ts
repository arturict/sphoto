// =============================================================================
// One-Click Data Export (DSGVO-compliant)
// =============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, createWriteStream, unlinkSync } from 'fs';
import { rm, stat, readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ExportJob, InstanceMetadata, SharedUser } from './types';
import { INSTANCES_DIR, EXTERNAL_STORAGE_PATH, env, SHARED_INSTANCES } from './config';

const execAsync = promisify(exec);

const EXPORTS_DIR = join(INSTANCES_DIR, '..', 'exports');
const EXPORT_EXPIRY_HOURS = 48; // 48 hours for user exports

// In-memory job storage (consider SQLite for production)
const exportJobs: Map<string, ExportJob> = new Map();

// Extended export job for shared users
interface SharedExportJob extends ExportJob {
  visibleId?: string;
  email?: string;
  totalAssets?: number;
  downloadedAssets?: number;
  notified?: boolean;
}

export function generateExportToken(): string {
  return Array.from({ length: 32 }, () => 
    Math.random().toString(36).charAt(2)
  ).join('');
}

export async function startExport(instanceId: string): Promise<ExportJob> {
  const metaPath = join(INSTANCES_DIR, instanceId, 'metadata.json');
  if (!existsSync(metaPath)) {
    throw new Error('Instance not found');
  }
  
  const jobId = `${instanceId}-${Date.now()}`;
  const job: ExportJob = {
    id: jobId,
    instanceId,
    status: 'pending',
    created: new Date().toISOString(),
  };
  
  exportJobs.set(jobId, job);
  
  // Start async export process
  processExport(jobId).catch(err => {
    console.error(`Export job ${jobId} failed:`, err);
    const j = exportJobs.get(jobId);
    if (j) {
      j.status = 'failed';
      j.error = err.message;
    }
  });
  
  return job;
}

export function getExportJob(jobId: string): ExportJob | null {
  return exportJobs.get(jobId) || null;
}

export function getExportByToken(token: string): { job: ExportJob; filePath: string } | null {
  for (const job of exportJobs.values()) {
    if (job.downloadToken === token && job.status === 'completed') {
      const now = new Date();
      const expires = new Date(job.expiresAt || 0);
      if (now < expires) {
        const filePath = join(EXPORTS_DIR, `${job.id}.zip`);
        if (existsSync(filePath)) {
          return { job, filePath };
        }
      }
    }
  }
  return null;
}

async function processExport(jobId: string): Promise<void> {
  const job = exportJobs.get(jobId);
  if (!job) return;
  
  job.status = 'processing';
  
  const instanceId = job.instanceId;
  const metaPath = join(INSTANCES_DIR, instanceId, 'metadata.json');
  const meta: InstanceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
  
  // Determine upload path
  let uploadsPath: string;
  if (EXTERNAL_STORAGE_PATH) {
    uploadsPath = join(EXTERNAL_STORAGE_PATH, instanceId, 'uploads');
  } else {
    uploadsPath = join(INSTANCES_DIR, instanceId, 'uploads');
  }
  
  if (!existsSync(uploadsPath)) {
    throw new Error('No uploads found');
  }
  
  // Create exports directory
  mkdirSync(EXPORTS_DIR, { recursive: true });
  
  const exportDir = join(EXPORTS_DIR, jobId);
  mkdirSync(exportDir, { recursive: true });
  
  try {
    // Create metadata export
    const exportMeta = {
      instance_id: instanceId,
      email: meta.email,
      plan: meta.plan,
      created: meta.created,
      exported_at: new Date().toISOString(),
    };
    writeFileSync(join(exportDir, 'metadata.json'), JSON.stringify(exportMeta, null, 2));
    
    // Collect file metadata
    const filesMetadata: Array<{
      path: string;
      size: number;
      modified: string;
    }> = [];
    
    await walkDirectory(uploadsPath, async (filePath) => {
      const relativePath = filePath.replace(uploadsPath, '').replace(/^\//, '');
      try {
        const stats = await stat(filePath);
        filesMetadata.push({
          path: relativePath,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
      } catch {
        // Skip inaccessible files
      }
    });
    
    writeFileSync(join(exportDir, 'files.json'), JSON.stringify(filesMetadata, null, 2));
    
    // Create ZIP archive
    const zipPath = join(EXPORTS_DIR, `${jobId}.zip`);
    await execAsync(`cd "${uploadsPath}" && zip -r "${zipPath}" . -x "*.log"`);
    
    // Add metadata files to ZIP
    await execAsync(`cd "${exportDir}" && zip -u "${zipPath}" metadata.json files.json`);
    
    // Get final file size
    const zipStats = await stat(zipPath);
    
    // Generate download token
    const token = generateExportToken();
    const expiresAt = new Date(Date.now() + EXPORT_EXPIRY_HOURS * 60 * 60 * 1000);
    
    job.status = 'completed';
    job.completed = new Date().toISOString();
    job.downloadToken = token;
    job.expiresAt = expiresAt.toISOString();
    job.fileSize = zipStats.size;
    
    // Clean up temp directory
    await rm(exportDir, { recursive: true, force: true });
    
    // Schedule deletion after expiry
    setTimeout(async () => {
      try {
        await rm(zipPath, { force: true });
        exportJobs.delete(jobId);
        console.log(`Export ${jobId} expired and deleted`);
      } catch {
        // Ignore cleanup errors
      }
    }, EXPORT_EXPIRY_HOURS * 60 * 60 * 1000);
    
    console.log(`Export ${jobId} completed: ${zipPath} (${zipStats.size} bytes)`);
    
  } catch (err) {
    // Clean up on failure
    await rm(exportDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

async function walkDirectory(
  dirPath: string, 
  callback: (filePath: string) => Promise<void>
): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await walkDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        await callback(fullPath);
      }
    }
  } catch {
    // Skip inaccessible directories
  }
}

export function listExportJobs(instanceId?: string): ExportJob[] {
  const jobs = Array.from(exportJobs.values());
  if (instanceId) {
    return jobs.filter(j => j.instanceId === instanceId);
  }
  return jobs;
}

// Cleanup expired exports on startup
export async function cleanupExpiredExports(): Promise<void> {
  if (!existsSync(EXPORTS_DIR)) return;
  
  const files = readdirSync(EXPORTS_DIR);
  for (const file of files) {
    if (file.endsWith('.zip')) {
      const filePath = join(EXPORTS_DIR, file);
      try {
        const stats = await stat(filePath);
        const age = Date.now() - stats.mtime.getTime();
        if (age > EXPORT_EXPIRY_HOURS * 60 * 60 * 1000) {
          await rm(filePath, { force: true });
          console.log(`Cleaned up expired export: ${file}`);
        }
      } catch {
        // Ignore errors
      }
    }
  }
}

// =============================================================================
// Shared User Export (via Immich API)
// =============================================================================

interface ImmichAsset {
  id: string;
  originalFileName: string;
  originalPath: string;
  type: 'IMAGE' | 'VIDEO';
  fileCreatedAt: string;
  fileModifiedAt: string;
}

async function immichApiCallForExport<T>(
  instance: 'free' | 'paid',
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const config = instance === 'free' ? SHARED_INSTANCES.free : SHARED_INSTANCES.paid;
  
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
      return { ok: false, error: `${response.status}: ${errorText}` };
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json() as T;
      return { ok: true, data };
    }
    
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function downloadAssetOriginal(
  instance: 'free' | 'paid',
  assetId: string,
  destPath: string
): Promise<{ ok: boolean; error?: string }> {
  const config = instance === 'free' ? SHARED_INSTANCES.free : SHARED_INSTANCES.paid;
  
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

    const buffer = await response.arrayBuffer();
    const fs = await import('fs/promises');
    await fs.writeFile(destPath, Buffer.from(buffer));
    
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function startSharedUserExport(
  visibleId: string,
  email: string,
  instance: 'free' | 'paid',
  immichUserId: string
): Promise<SharedExportJob> {
  const jobId = `shared-${visibleId}-${Date.now()}`;
  const job: SharedExportJob = {
    id: jobId,
    instanceId: `shared-${instance}`,
    visibleId,
    email,
    status: 'pending',
    created: new Date().toISOString(),
    totalAssets: 0,
    downloadedAssets: 0,
  };
  
  exportJobs.set(jobId, job);
  
  // Start async export process
  processSharedUserExport(jobId, instance, immichUserId).catch(err => {
    console.error(`Shared export job ${jobId} failed:`, err);
    const j = exportJobs.get(jobId) as SharedExportJob;
    if (j) {
      j.status = 'failed';
      j.error = err.message;
    }
  });
  
  return job;
}

async function processSharedUserExport(
  jobId: string,
  instance: 'free' | 'paid',
  immichUserId: string
): Promise<void> {
  const job = exportJobs.get(jobId) as SharedExportJob;
  if (!job) return;
  
  job.status = 'processing';
  console.log(`[Export] Starting export for user ${job.email} on ${instance}`);
  
  // Create exports directory
  mkdirSync(EXPORTS_DIR, { recursive: true });
  
  const exportDir = join(EXPORTS_DIR, jobId);
  await mkdir(exportDir, { recursive: true });
  const assetsDir = join(exportDir, 'photos');
  await mkdir(assetsDir, { recursive: true });
  
  try {
    // Step 1: Get all assets for this user with pagination
    // Immich has a max page size of 1000, so we need to paginate
    const PAGE_SIZE = 1000;
    let allAssets: ImmichAsset[] = [];
    let page = 1;
    let hasMore = true;

    console.log(`[Export] Fetching assets for ${job.email} on ${instance}...`);

    while (hasMore) {
      const searchResult = await immichApiCallForExport<{ assets: { items: ImmichAsset[]; total: number; nextPage: string | null } }>(
        instance,
        '/api/search/metadata',
        {
          method: 'POST',
          body: JSON.stringify({
            ownerId: immichUserId,
            size: PAGE_SIZE,
            page: page,
          }),
        }
      );

      if (!searchResult.ok || !searchResult.data) {
        throw new Error(`Failed to get assets: ${searchResult.error}`);
      }

      const pageAssets = searchResult.data.assets.items;
      allAssets = allAssets.concat(pageAssets);
      
      console.log(`[Export] Page ${page}: fetched ${pageAssets.length} assets (total so far: ${allAssets.length})`);

      // Check if there are more pages
      if (pageAssets.length < PAGE_SIZE || searchResult.data.assets.nextPage === null) {
        hasMore = false;
      } else {
        page++;
      }
    }

    const assets = allAssets;
    job.totalAssets = assets.length;
    console.log(`[Export] Found ${assets.length} total assets for ${job.email}`);

    if (assets.length === 0) {
      // No assets - create empty export with just metadata
      const exportMeta = {
        email: job.email,
        visibleId: job.visibleId,
        instance,
        exported_at: new Date().toISOString(),
        total_files: 0,
        message: 'No photos or videos found',
      };
      writeFileSync(join(exportDir, 'export-info.json'), JSON.stringify(exportMeta, null, 2));
    } else {
      // Step 2: Download each original file
      const errors: string[] = [];
      
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        job.downloadedAssets = i + 1;
        
        // Create filename with date prefix for organization
        const date = new Date(asset.fileCreatedAt);
        const datePrefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const safeFilename = asset.originalFileName.replace(/[/\\?%*:|"<>]/g, '_');
        const filename = `${datePrefix}_${safeFilename}`;
        const destPath = join(assetsDir, filename);
        
        const result = await downloadAssetOriginal(instance, asset.id, destPath);
        if (!result.ok) {
          errors.push(`${asset.originalFileName}: ${result.error}`);
          console.log(`[Export] Failed to download ${asset.originalFileName}: ${result.error}`);
        }
        
        // Log progress every 50 files
        if ((i + 1) % 50 === 0 || i + 1 === assets.length) {
          console.log(`[Export] Progress: ${i + 1}/${assets.length} files downloaded`);
        }
      }

      // Create export metadata
      const exportMeta = {
        email: job.email,
        visibleId: job.visibleId,
        instance,
        exported_at: new Date().toISOString(),
        total_files: assets.length,
        downloaded_files: assets.length - errors.length,
        errors: errors.length > 0 ? errors : undefined,
        files: assets.map(a => ({
          id: a.id,
          name: a.originalFileName,
          type: a.type,
          created: a.fileCreatedAt,
        })),
      };
      writeFileSync(join(exportDir, 'export-info.json'), JSON.stringify(exportMeta, null, 2));
    }

    // Step 3: Create ZIP archive
    const zipPath = join(EXPORTS_DIR, `${jobId}.zip`);
    await execAsync(`cd "${exportDir}" && zip -r "${zipPath}" .`);
    
    // Get final file size
    const zipStats = await stat(zipPath);
    
    // Generate download token
    const token = generateExportToken();
    const expiresAt = new Date(Date.now() + EXPORT_EXPIRY_HOURS * 60 * 60 * 1000);
    
    job.status = 'completed';
    job.completed = new Date().toISOString();
    job.downloadToken = token;
    job.expiresAt = expiresAt.toISOString();
    job.fileSize = zipStats.size;
    
    // Clean up temp directory
    await rm(exportDir, { recursive: true, force: true });
    
    // Schedule deletion after expiry
    setTimeout(async () => {
      try {
        await rm(zipPath, { force: true });
        exportJobs.delete(jobId);
        console.log(`Export ${jobId} expired and deleted`);
      } catch {
        // Ignore cleanup errors
      }
    }, EXPORT_EXPIRY_HOURS * 60 * 60 * 1000);
    
    console.log(`[Export] Completed for ${job.email}: ${zipPath} (${zipStats.size} bytes)`);
    
  } catch (err) {
    // Clean up on failure
    await rm(exportDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

export function getSharedExportJob(jobId: string): SharedExportJob | null {
  return exportJobs.get(jobId) as SharedExportJob || null;
}

export function getLatestExportForUser(visibleId: string): SharedExportJob | null {
  const jobs = Array.from(exportJobs.values()) as SharedExportJob[];
  const userJobs = jobs
    .filter(j => j.visibleId === visibleId)
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  return userJobs[0] || null;
}

// =============================================================================
// One-Click Data Export (DSGVO-compliant)
// =============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { rm, stat, readdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ExportJob, InstanceMetadata } from './types';
import { INSTANCES_DIR, EXTERNAL_STORAGE_PATH, env } from './config';

const execAsync = promisify(exec);

const EXPORTS_DIR = '/data/exports';
const EXPORT_EXPIRY_HOURS = 24;

// In-memory job storage (consider SQLite for production)
const exportJobs: Map<string, ExportJob> = new Map();

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

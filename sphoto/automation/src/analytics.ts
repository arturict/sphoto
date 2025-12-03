// =============================================================================
// Usage Analytics for Admin
// =============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { stat, readdir } from 'fs/promises';
import { join } from 'path';
import type { DailyStats, AnalyticsData, InstanceMetadata } from './types';
import { INSTANCES_DIR, EXTERNAL_STORAGE_PATH } from './config';

const STATS_DIR = '/data/stats';
const STATS_RETENTION_DAYS = 90;

export function getStatsFilePath(date: string): string {
  return join(STATS_DIR, `${date}.json`);
}

export function loadDailyStats(date: string): DailyStats | null {
  const filePath = getStatsFilePath(date);
  if (!existsSync(filePath)) return null;
  
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveDailyStats(stats: DailyStats): void {
  mkdirSync(STATS_DIR, { recursive: true });
  const filePath = getStatsFilePath(stats.date);
  writeFileSync(filePath, JSON.stringify(stats, null, 2));
}

export async function collectDailyStats(): Promise<DailyStats> {
  const today = new Date().toISOString().split('T')[0];
  const stats: DailyStats = {
    date: today,
    instances: {},
  };
  
  if (!existsSync(INSTANCES_DIR)) {
    return stats;
  }
  
  const instanceDirs = readdirSync(INSTANCES_DIR);
  
  for (const instanceId of instanceDirs) {
    const metaPath = join(INSTANCES_DIR, instanceId, 'metadata.json');
    if (!existsSync(metaPath)) continue;
    
    try {
      const meta: InstanceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
      if (meta.status === 'deleted') continue;
      
      // Determine upload path
      let uploadsPath: string;
      if (EXTERNAL_STORAGE_PATH) {
        uploadsPath = join(EXTERNAL_STORAGE_PATH, instanceId, 'uploads');
      } else {
        uploadsPath = join(INSTANCES_DIR, instanceId, 'uploads');
      }
      
      let storageBytes = 0;
      let fileCount = 0;
      
      if (existsSync(uploadsPath)) {
        const result = await getDirectorySizeAndCount(uploadsPath);
        storageBytes = result.size;
        fileCount = result.count;
      }
      
      stats.instances[instanceId] = {
        storage_bytes: storageBytes,
        files: fileCount,
      };
    } catch {
      // Skip problematic instances
    }
  }
  
  return stats;
}

async function getDirectorySizeAndCount(dirPath: string): Promise<{ size: number; count: number }> {
  let totalSize = 0;
  let totalCount = 0;
  
  async function walkDir(currentPath: string): Promise<void> {
    try {
      const entries = await readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.isFile()) {
          try {
            const stats = await stat(fullPath);
            totalSize += stats.size;
            totalCount += 1;
          } catch {
            // Skip inaccessible files
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
  
  await walkDir(dirPath);
  return { size: totalSize, count: totalCount };
}

export function getAnalytics(days: number = 30): AnalyticsData {
  const stats: DailyStats[] = [];
  const today = new Date();
  
  // Load historical stats
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayStats = loadDailyStats(dateStr);
    if (dayStats) {
      stats.push(dayStats);
    }
  }
  
  // Sort by date ascending
  stats.sort((a, b) => a.date.localeCompare(b.date));
  
  // Calculate upload trend (files added per day)
  const uploadTrend: Array<{ date: string; uploads: number }> = [];
  for (let i = 1; i < stats.length; i++) {
    const prevTotal = Object.values(stats[i - 1].instances).reduce((sum, inst) => sum + inst.files, 0);
    const currTotal = Object.values(stats[i].instances).reduce((sum, inst) => sum + inst.files, 0);
    uploadTrend.push({
      date: stats[i].date,
      uploads: Math.max(0, currTotal - prevTotal),
    });
  }
  
  // Calculate storage growth
  const storageGrowth: Array<{ date: string; total_bytes: number }> = stats.map(s => ({
    date: s.date,
    total_bytes: Object.values(s.instances).reduce((sum, inst) => sum + inst.storage_bytes, 0),
  }));
  
  // Get latest stats for current state
  const latestStats = stats[stats.length - 1];
  
  // Count active instances (those in latest stats)
  const activeInstances = latestStats ? Object.keys(latestStats.instances).length : 0;
  
  // Get instance metadata for activity check
  const inactiveInstances = countInactiveInstances();
  
  // Top instances by storage
  const topInstances: Array<{ id: string; storage_bytes: number; files: number }> = [];
  if (latestStats) {
    const entries = Object.entries(latestStats.instances)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.storage_bytes - a.storage_bytes)
      .slice(0, 10);
    topInstances.push(...entries);
  }
  
  // Churn risk: instances with no file changes in 14+ days
  const churnRisk = detectChurnRisk(stats);
  
  return {
    uploadTrend,
    storageGrowth,
    activeInstances,
    inactiveInstances,
    topInstances,
    churnRisk,
  };
}

function countInactiveInstances(): number {
  if (!existsSync(INSTANCES_DIR)) return 0;
  
  let count = 0;
  const instanceDirs = readdirSync(INSTANCES_DIR);
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  
  for (const instanceId of instanceDirs) {
    const metaPath = join(INSTANCES_DIR, instanceId, 'metadata.json');
    if (!existsSync(metaPath)) continue;
    
    try {
      const meta: InstanceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
      if (meta.status === 'stopped') {
        const stoppedAt = meta.stopped_at ? new Date(meta.stopped_at).getTime() : 0;
        if (stoppedAt < fourteenDaysAgo) {
          count++;
        }
      }
    } catch {
      // Skip
    }
  }
  
  return count;
}

function detectChurnRisk(stats: DailyStats[]): Array<{ id: string; lastActivity: string }> {
  if (stats.length < 14) return [];
  
  const churnRisk: Array<{ id: string; lastActivity: string }> = [];
  const latestStats = stats[stats.length - 1];
  if (!latestStats) return [];
  
  for (const instanceId of Object.keys(latestStats.instances)) {
    let lastActivityDate = '';
    let lastFileCount = 0;
    
    // Find last date when file count changed
    for (const dayStats of stats) {
      const instData = dayStats.instances[instanceId];
      if (instData) {
        if (instData.files !== lastFileCount) {
          lastActivityDate = dayStats.date;
          lastFileCount = instData.files;
        }
      }
    }
    
    // Check if no activity in 14+ days
    if (lastActivityDate) {
      const daysSinceActivity = Math.floor(
        (Date.now() - new Date(lastActivityDate).getTime()) / (24 * 60 * 60 * 1000)
      );
      
      if (daysSinceActivity >= 14) {
        churnRisk.push({
          id: instanceId,
          lastActivity: lastActivityDate,
        });
      }
    }
  }
  
  return churnRisk.sort((a, b) => a.lastActivity.localeCompare(b.lastActivity));
}

export function cleanupOldStats(): void {
  if (!existsSync(STATS_DIR)) return;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - STATS_RETENTION_DAYS);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  
  const files = readdirSync(STATS_DIR);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const date = file.replace('.json', '');
      if (date < cutoffStr) {
        try {
          const filePath = join(STATS_DIR, file);
          require('fs').unlinkSync(filePath);
          console.log(`Cleaned up old stats: ${file}`);
        } catch {
          // Ignore
        }
      }
    }
  }
}

// Run daily stats collection (called by cron or at startup)
export async function runDailyStatsCollection(): Promise<void> {
  console.log('Starting daily stats collection...');
  
  try {
    const stats = await collectDailyStats();
    saveDailyStats(stats);
    console.log(`Daily stats collected: ${Object.keys(stats.instances).length} instances`);
    
    cleanupOldStats();
  } catch (err) {
    console.error('Failed to collect daily stats:', err);
  }
}

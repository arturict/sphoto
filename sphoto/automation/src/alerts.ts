// =============================================================================
// Usage Alerts System
// =============================================================================

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Resend } from 'resend';
import { env, INSTANCES_DIR, EXTERNAL_STORAGE_PATH } from './config';
import { listInstances, getInstance, getDirectorySize } from './instances';
import type { InstanceMetadata } from './types';

const resend = new Resend(env.RESEND_API_KEY);

// =============================================================================
// Types
// =============================================================================

export type AlertType = 
  | 'storage_80'
  | 'storage_90'
  | 'storage_100'
  | 'inactive'
  | 'churn_risk'
  | 'instance_down'
  | 'backup_failed';

export interface AlertSettings {
  emailAlerts: boolean;
  storageThresholds: number[];
  inactivityDays: number;
  churnRiskDays: number;
}

export interface AlertHistory {
  lastAlerts: Record<AlertType, string | null>;
  settings: AlertSettings;
}

export interface AlertSummary {
  instanceId: string;
  type: AlertType;
  triggeredAt: string;
  recipient: 'customer' | 'admin' | 'both';
  details: Record<string, unknown>;
}

// Default cooldown period (24 hours)
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const DEFAULT_SETTINGS: AlertSettings = {
  emailAlerts: true,
  storageThresholds: [80, 90, 100],
  inactivityDays: 14,
  churnRiskDays: 30,
};

// =============================================================================
// Alert History Management
// =============================================================================

function getAlertsPath(instanceId: string): string {
  return join(INSTANCES_DIR, instanceId, 'alerts.json');
}

export function getAlertHistory(instanceId: string): AlertHistory {
  const alertsPath = getAlertsPath(instanceId);
  
  if (!existsSync(alertsPath)) {
    return {
      lastAlerts: {
        storage_80: null,
        storage_90: null,
        storage_100: null,
        inactive: null,
        churn_risk: null,
        instance_down: null,
        backup_failed: null,
      },
      settings: { ...DEFAULT_SETTINGS },
    };
  }
  
  try {
    return JSON.parse(readFileSync(alertsPath, 'utf-8'));
  } catch {
    return {
      lastAlerts: {
        storage_80: null,
        storage_90: null,
        storage_100: null,
        inactive: null,
        churn_risk: null,
        instance_down: null,
        backup_failed: null,
      },
      settings: { ...DEFAULT_SETTINGS },
    };
  }
}

function saveAlertHistory(instanceId: string, history: AlertHistory): void {
  const alertsPath = getAlertsPath(instanceId);
  writeFileSync(alertsPath, JSON.stringify(history, null, 2));
}

export function updateAlertSettings(instanceId: string, settings: Partial<AlertSettings>): AlertHistory {
  const history = getAlertHistory(instanceId);
  history.settings = { ...history.settings, ...settings };
  saveAlertHistory(instanceId, history);
  return history;
}

// =============================================================================
// Alert Checking Logic
// =============================================================================

function isAlertOnCooldown(lastAlertTime: string | null): boolean {
  if (!lastAlertTime) return false;
  const lastTime = new Date(lastAlertTime).getTime();
  return Date.now() - lastTime < ALERT_COOLDOWN_MS;
}

async function getStorageUsage(instanceId: string): Promise<{ usedBytes: number; limitBytes: number; percentage: number }> {
  const instance = getInstance(instanceId);
  if (!instance) {
    return { usedBytes: 0, limitBytes: 0, percentage: 0 };
  }
  
  let uploadsPath: string;
  if (EXTERNAL_STORAGE_PATH) {
    uploadsPath = join(EXTERNAL_STORAGE_PATH, instanceId, 'uploads');
  } else {
    uploadsPath = join(INSTANCES_DIR, instanceId, 'uploads');
  }
  
  if (!existsSync(uploadsPath)) {
    return { usedBytes: 0, limitBytes: instance.storage_gb * 1024 * 1024 * 1024, percentage: 0 };
  }
  
  const usedBytes = await getDirectorySize(uploadsPath);
  const limitBytes = instance.storage_gb * 1024 * 1024 * 1024;
  const percentage = Math.round((usedBytes / limitBytes) * 100);
  
  return { usedBytes, limitBytes, percentage };
}

async function checkInstanceHealth(instanceId: string, domain: string): Promise<boolean> {
  const instance = getInstance(instanceId);
  if (!instance || instance.status !== 'active') {
    return true; // Don't alert for stopped instances
  }
  
  const url = `https://${instanceId}.${domain}`;
  const endpoint = instance.platform === 'nextcloud' ? '/status.php' : '/api/server/ping';
  
  try {
    const response = await fetch(`${url}${endpoint}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function getLastActivityDate(instance: InstanceMetadata): Date | null {
  // Check for last upload activity from analytics if available
  const statsPath = join(INSTANCES_DIR, '..', 'stats', 'daily');
  
  if (existsSync(statsPath)) {
    // Get most recent stats file
    const { readdirSync } = require('fs');
    const files = readdirSync(statsPath)
      .filter((f: string) => f.endsWith('.json'))
      .sort()
      .reverse();
    
    for (const file of files) {
      try {
        const stats = JSON.parse(readFileSync(join(statsPath, file), 'utf-8'));
        if (stats.instances && stats.instances[instance.id]) {
          return new Date(file.replace('.json', ''));
        }
      } catch {
        // Continue to next file
      }
    }
  }
  
  // Fall back to instance creation date
  return new Date(instance.created);
}

// =============================================================================
// Email Templates
// =============================================================================

async function sendStorageWarningEmail(
  email: string,
  instanceId: string,
  percentage: number,
  usedGb: number,
  limitGb: number
): Promise<void> {
  const isWarning = percentage < 100;
  const color = percentage >= 100 ? '#dc2626' : percentage >= 90 ? '#ea580c' : '#ca8a04';
  const icon = percentage >= 100 ? '🔴' : percentage >= 90 ? '🟠' : '🟡';
  
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: `${icon} SPhoto: Speicher ${percentage}% belegt`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;"><span style="color: #dc2626;">S</span>Photo</h1>
        
        <div style="background: ${color}15; border: 1px solid ${color}; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: ${color};">
            ${icon} Speicherwarnung
          </p>
          <p style="margin: 0;">
            Deine Instanz <strong>${instanceId}</strong> nutzt ${percentage}% des verfügbaren Speichers.
          </p>
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Genutzt:</strong> ${usedGb.toFixed(1)} GB von ${limitGb} GB</p>
          <div style="background: #e5e7eb; border-radius: 4px; height: 8px; margin-top: 10px;">
            <div style="background: ${color}; border-radius: 4px; height: 8px; width: ${Math.min(percentage, 100)}%;"></div>
          </div>
        </div>
        
        ${isWarning ? `
          <p>Empfehlungen:</p>
          <ul>
            <li>Lösche nicht benötigte Fotos/Videos</li>
            <li>Upgrade auf einen grösseren Plan</li>
          </ul>
        ` : `
          <p style="color: #dc2626; font-weight: bold;">
            ⚠️ Dein Speicher ist voll. Neue Uploads sind nicht mehr möglich.
          </p>
          <p>
            Bitte lösche Dateien oder upgrade deinen Plan um fortzufahren.
          </p>
        `}
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `,
  });
  
  console.log(`Storage warning email (${percentage}%) sent to ${email}`);
}

async function sendInactiveReminderEmail(
  email: string,
  instanceId: string,
  daysSinceActivity: number
): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: '👋 Wir vermissen dich bei SPhoto!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;"><span style="color: #dc2626;">S</span>Photo</h1>
        
        <p>Hallo!</p>
        <p>
          Wir haben bemerkt, dass du seit <strong>${daysSinceActivity} Tagen</strong> 
          nicht mehr bei SPhoto aktiv warst.
        </p>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Deine Instanz:</strong></p>
          <p style="margin: 5px 0;">
            <a href="https://${instanceId}.${env.DOMAIN}" style="color: #dc2626;">
              ${instanceId}.${env.DOMAIN}
            </a>
          </p>
        </div>
        
        <p>Deine Fotos und Videos sind sicher gespeichert und warten auf dich!</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://${instanceId}.${env.DOMAIN}" 
             style="display: inline-block; background: #dc2626; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Zur App
          </a>
        </div>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `,
  });
  
  console.log(`Inactive reminder email sent to ${email}`);
}

async function sendInstanceDownEmail(
  adminEmail: string,
  instanceId: string,
  platform: string
): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: adminEmail,
    subject: `🚨 ALERT: Instance ${instanceId} is down`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #dc2626;">⚠️ Instance Down Alert</h1>
        
        <div style="background: #fef2f2; border: 1px solid #dc2626; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Instance:</strong> ${instanceId}</p>
          <p style="margin: 0 0 10px 0;"><strong>Platform:</strong> ${platform}</p>
          <p style="margin: 0 0 10px 0;"><strong>URL:</strong> https://${instanceId}.${env.DOMAIN}</p>
          <p style="margin: 0;"><strong>Time:</strong> ${new Date().toISOString()}</p>
        </div>
        
        <p>Health check failed. Please investigate immediately.</p>
        
        <p><strong>Suggested actions:</strong></p>
        <ul>
          <li>Check Docker containers: <code>docker ps | grep ${instanceId}</code></li>
          <li>Check logs: <code>docker logs sphoto-${instanceId}-server</code></li>
          <li>Restart: <code>cd /data/instances/${instanceId} && docker compose restart</code></li>
        </ul>
      </div>
    `,
  });
  
  console.log(`Instance down alert sent for ${instanceId}`);
}

async function sendChurnRiskEmail(
  adminEmail: string,
  instanceId: string,
  email: string,
  daysSinceUpload: number
): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: adminEmail,
    subject: `📉 Churn Risk: ${instanceId} (${daysSinceUpload} days inactive)`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #ea580c;">📉 Churn Risk Alert</h1>
        
        <div style="background: #fff7ed; border: 1px solid #ea580c; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Instance:</strong> ${instanceId}</p>
          <p style="margin: 0 0 10px 0;"><strong>Customer:</strong> ${email}</p>
          <p style="margin: 0;"><strong>Days since last upload:</strong> ${daysSinceUpload}</p>
        </div>
        
        <p>This customer hasn't uploaded any files in ${daysSinceUpload} days.</p>
        <p>Consider reaching out to understand if they need help.</p>
      </div>
    `,
  });
  
  console.log(`Churn risk alert sent for ${instanceId}`);
}

// =============================================================================
// Main Alert Check Function
// =============================================================================

export async function checkInstanceAlerts(
  instanceId: string,
  adminEmail: string
): Promise<AlertSummary[]> {
  const instance = getInstance(instanceId);
  if (!instance) return [];
  
  const history = getAlertHistory(instanceId);
  const alerts: AlertSummary[] = [];
  const now = new Date().toISOString();
  
  if (!history.settings.emailAlerts) {
    return alerts;
  }
  
  // 1. Check storage usage
  const storage = await getStorageUsage(instanceId);
  
  if (storage.percentage >= 100 && !isAlertOnCooldown(history.lastAlerts.storage_100)) {
    await sendStorageWarningEmail(
      instance.email,
      instanceId,
      storage.percentage,
      storage.usedBytes / (1024 * 1024 * 1024),
      storage.limitBytes / (1024 * 1024 * 1024)
    );
    // Also notify admin
    await sendStorageWarningEmail(
      adminEmail,
      instanceId,
      storage.percentage,
      storage.usedBytes / (1024 * 1024 * 1024),
      storage.limitBytes / (1024 * 1024 * 1024)
    );
    history.lastAlerts.storage_100 = now;
    alerts.push({
      instanceId,
      type: 'storage_100',
      triggeredAt: now,
      recipient: 'both',
      details: { percentage: storage.percentage, usedGb: storage.usedBytes / (1024 * 1024 * 1024) },
    });
  } else if (storage.percentage >= 90 && storage.percentage < 100 && !isAlertOnCooldown(history.lastAlerts.storage_90)) {
    await sendStorageWarningEmail(
      instance.email,
      instanceId,
      storage.percentage,
      storage.usedBytes / (1024 * 1024 * 1024),
      storage.limitBytes / (1024 * 1024 * 1024)
    );
    history.lastAlerts.storage_90 = now;
    alerts.push({
      instanceId,
      type: 'storage_90',
      triggeredAt: now,
      recipient: 'customer',
      details: { percentage: storage.percentage },
    });
  } else if (storage.percentage >= 80 && storage.percentage < 90 && !isAlertOnCooldown(history.lastAlerts.storage_80)) {
    await sendStorageWarningEmail(
      instance.email,
      instanceId,
      storage.percentage,
      storage.usedBytes / (1024 * 1024 * 1024),
      storage.limitBytes / (1024 * 1024 * 1024)
    );
    history.lastAlerts.storage_80 = now;
    alerts.push({
      instanceId,
      type: 'storage_80',
      triggeredAt: now,
      recipient: 'customer',
      details: { percentage: storage.percentage },
    });
  }
  
  // 2. Check instance health
  const isHealthy = await checkInstanceHealth(instanceId, env.DOMAIN);
  if (!isHealthy && !isAlertOnCooldown(history.lastAlerts.instance_down)) {
    await sendInstanceDownEmail(adminEmail, instanceId, instance.platform);
    history.lastAlerts.instance_down = now;
    alerts.push({
      instanceId,
      type: 'instance_down',
      triggeredAt: now,
      recipient: 'admin',
      details: { platform: instance.platform },
    });
  }
  
  // 3. Check inactivity
  const lastActivity = getLastActivityDate(instance);
  if (lastActivity) {
    const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceActivity >= history.settings.churnRiskDays && !isAlertOnCooldown(history.lastAlerts.churn_risk)) {
      await sendChurnRiskEmail(adminEmail, instanceId, instance.email, daysSinceActivity);
      history.lastAlerts.churn_risk = now;
      alerts.push({
        instanceId,
        type: 'churn_risk',
        triggeredAt: now,
        recipient: 'admin',
        details: { daysSinceActivity },
      });
    } else if (daysSinceActivity >= history.settings.inactivityDays && !isAlertOnCooldown(history.lastAlerts.inactive)) {
      await sendInactiveReminderEmail(instance.email, instanceId, daysSinceActivity);
      history.lastAlerts.inactive = now;
      alerts.push({
        instanceId,
        type: 'inactive',
        triggeredAt: now,
        recipient: 'admin',
        details: { daysSinceActivity },
      });
    }
  }
  
  saveAlertHistory(instanceId, history);
  return alerts;
}

export async function runAlertCheck(adminEmail: string): Promise<AlertSummary[]> {
  console.log('Running alert check for all instances...');
  
  const instances = listInstances();
  const allAlerts: AlertSummary[] = [];
  
  for (const instance of instances) {
    if (instance.status === 'active') {
      try {
        const alerts = await checkInstanceAlerts(instance.id, adminEmail);
        allAlerts.push(...alerts);
      } catch (err) {
        console.error(`Error checking alerts for ${instance.id}:`, err);
      }
    }
  }
  
  console.log(`Alert check complete. ${allAlerts.length} alerts triggered.`);
  return allAlerts;
}

export async function sendTestAlert(
  instanceId: string,
  alertType: AlertType,
  adminEmail: string
): Promise<void> {
  const instance = getInstance(instanceId);
  if (!instance) {
    throw new Error('Instance not found');
  }
  
  switch (alertType) {
    case 'storage_80':
    case 'storage_90':
    case 'storage_100':
      await sendStorageWarningEmail(
        instance.email,
        instanceId,
        parseInt(alertType.split('_')[1]),
        50,
        200
      );
      break;
    case 'inactive':
      await sendInactiveReminderEmail(instance.email, instanceId, 14);
      break;
    case 'instance_down':
      await sendInstanceDownEmail(adminEmail, instanceId, instance.platform);
      break;
    case 'churn_risk':
      await sendChurnRiskEmail(adminEmail, instanceId, instance.email, 30);
      break;
    default:
      throw new Error(`Unknown alert type: ${alertType}`);
  }
}

export function getActiveAlerts(): AlertSummary[] {
  const instances = listInstances();
  const activeAlerts: AlertSummary[] = [];
  
  for (const instance of instances) {
    const history = getAlertHistory(instance.id);
    
    for (const [type, timestamp] of Object.entries(history.lastAlerts)) {
      if (timestamp && !isAlertOnCooldown(timestamp)) {
        // This alert was triggered but cooldown expired - it's still active if condition persists
        // For summary, we show recent alerts (within 7 days)
        const alertTime = new Date(timestamp).getTime();
        if (Date.now() - alertTime < 7 * 24 * 60 * 60 * 1000) {
          activeAlerts.push({
            instanceId: instance.id,
            type: type as AlertType,
            triggeredAt: timestamp,
            recipient: type.includes('storage') && type !== 'storage_100' ? 'customer' : 
                       type === 'storage_100' ? 'both' : 'admin',
            details: {},
          });
        }
      }
    }
  }
  
  return activeAlerts.sort((a, b) => 
    new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
  );
}

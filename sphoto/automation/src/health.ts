// =============================================================================
// Health Monitoring Service
// =============================================================================

import { Resend } from 'resend';
import { env, INSTANCES_DIR } from './config';
import { listInstances, getInstance } from './instances';
import type { InstanceMetadata } from './types';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const resend = new Resend(env.RESEND_API_KEY);

// =============================================================================
// Types
// =============================================================================

export interface HealthStatus {
  instanceId: string;
  healthy: boolean;
  responseTime: number | null;
  sslValid: boolean;
  sslExpiresAt: string | null;
  sslDaysRemaining: number | null;
  lastCheck: string;
  consecutiveFailures: number;
}

export interface HealthSummary {
  totalInstances: number;
  healthyInstances: number;
  unhealthyInstances: number;
  sslExpiringInstances: number;
  statuses: HealthStatus[];
}

interface HealthState {
  statuses: Record<string, HealthStatus>;
  lastFullCheck: string;
}

// =============================================================================
// Storage
// =============================================================================

const HEALTH_DIR = join(INSTANCES_DIR, '..', 'health');
const HEALTH_FILE = join(HEALTH_DIR, 'health.json');

function ensureHealthDir(): void {
  if (!existsSync(HEALTH_DIR)) {
    mkdirSync(HEALTH_DIR, { recursive: true });
  }
}

function loadHealthState(): HealthState {
  ensureHealthDir();
  if (!existsSync(HEALTH_FILE)) {
    return { statuses: {}, lastFullCheck: '' };
  }
  try {
    return JSON.parse(readFileSync(HEALTH_FILE, 'utf-8'));
  } catch {
    return { statuses: {}, lastFullCheck: '' };
  }
}

function saveHealthState(state: HealthState): void {
  ensureHealthDir();
  writeFileSync(HEALTH_FILE, JSON.stringify(state, null, 2));
}

// =============================================================================
// Health Check Functions
// =============================================================================

async function checkInstanceHealth(instance: InstanceMetadata): Promise<HealthStatus> {
  const url = `https://${instance.id}.${env.DOMAIN}`;
  const endpoint = instance.platform === 'nextcloud' ? '/status.php' : '/api/server/ping';
  
  const startTime = Date.now();
  let healthy = false;
  let responseTime: number | null = null;
  let sslValid = false;
  let sslExpiresAt: string | null = null;
  let sslDaysRemaining: number | null = null;
  
  try {
    const response = await fetch(`${url}${endpoint}`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });
    
    responseTime = Date.now() - startTime;
    healthy = response.ok;
    sslValid = true; // If we got a response, SSL is working
    
  } catch (err) {
    if (err instanceof Error) {
      // Check if it's an SSL error
      if (err.message.includes('certificate') || err.message.includes('SSL')) {
        sslValid = false;
      }
    }
  }
  
  // Check SSL certificate expiry using a separate connection
  try {
    const sslInfo = await checkSSLExpiry(`${instance.id}.${env.DOMAIN}`);
    if (sslInfo) {
      sslExpiresAt = sslInfo.expiresAt;
      sslDaysRemaining = sslInfo.daysRemaining;
      sslValid = sslInfo.valid;
    }
  } catch {
    // SSL check failed, keep existing values
  }
  
  return {
    instanceId: instance.id,
    healthy,
    responseTime,
    sslValid,
    sslExpiresAt,
    sslDaysRemaining,
    lastCheck: new Date().toISOString(),
    consecutiveFailures: 0,
  };
}

async function checkSSLExpiry(hostname: string): Promise<{ valid: boolean; expiresAt: string; daysRemaining: number } | null> {
  // Use Node's TLS module to check certificate
  const tls = await import('tls');
  
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: hostname,
      port: 443,
      servername: hostname,
      timeout: 5000,
    }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      
      if (cert && cert.valid_to) {
        const expiresAt = new Date(cert.valid_to).toISOString();
        const daysRemaining = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        resolve({
          valid: daysRemaining > 0,
          expiresAt,
          daysRemaining,
        });
      } else {
        resolve(null);
      }
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(null);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
  });
}

// =============================================================================
// Email Functions
// =============================================================================

async function sendHealthAlertEmail(
  status: HealthStatus,
  instance: InstanceMetadata
): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: env.ADMIN_EMAIL,
    subject: `🚨 Health Alert: ${status.instanceId} is ${status.healthy ? 'recovering' : 'down'}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #dc2626;">⚠️ Health Alert</h1>
        
        <div style="background: ${status.healthy ? '#dcfce7' : '#fef2f2'}; border: 1px solid ${status.healthy ? '#22c55e' : '#dc2626'}; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Instance:</strong> ${status.instanceId}</p>
          <p style="margin: 0 0 10px 0;"><strong>Platform:</strong> ${instance.platform}</p>
          <p style="margin: 0 0 10px 0;"><strong>Status:</strong> ${status.healthy ? '✅ Healthy' : '❌ Unhealthy'}</p>
          <p style="margin: 0 0 10px 0;"><strong>Response Time:</strong> ${status.responseTime ? `${status.responseTime}ms` : 'N/A'}</p>
          <p style="margin: 0;"><strong>Last Check:</strong> ${status.lastCheck}</p>
        </div>
        
        ${!status.healthy ? `
          <p><strong>Consecutive Failures:</strong> ${status.consecutiveFailures}</p>
          <p><strong>Suggested Actions:</strong></p>
          <ul>
            <li>Check Docker containers: <code>docker ps | grep ${status.instanceId}</code></li>
            <li>Check logs: <code>docker logs sphoto-${status.instanceId}-server</code></li>
            <li>Restart: <code>cd /data/instances/${status.instanceId} && docker compose restart</code></li>
          </ul>
        ` : `
          <p style="color: #22c55e;">Instance has recovered and is now healthy.</p>
        `}
      </div>
    `,
  });
  
  console.log(`Health alert sent for ${status.instanceId}`);
}

async function sendSSLExpiryAlertEmail(
  status: HealthStatus,
  instance: InstanceMetadata
): Promise<void> {
  // Only send for critical cases (≤7 days) - SSL should auto-renew via Traefik
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: env.ADMIN_EMAIL,
    subject: `🔴 CRITICAL: SSL auto-renewal may have failed - ${status.instanceId}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #dc2626;">🔐 SSL Certificate Critical Warning</h1>
        
        <div style="background: #fef2f2; border: 1px solid #dc2626; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Instance:</strong> ${status.instanceId}</p>
          <p style="margin: 0 0 10px 0;"><strong>Domain:</strong> ${status.instanceId}.${env.DOMAIN}</p>
          <p style="margin: 0 0 10px 0;"><strong>Expires:</strong> ${status.sslExpiresAt}</p>
          <p style="margin: 0;"><strong>Days Remaining:</strong> ${status.sslDaysRemaining}</p>
        </div>
        
        <p><strong>⚠️ SSL should auto-renew via Traefik/Let's Encrypt.</strong></p>
        <p>This alert means auto-renewal may have failed. Please check:</p>
        <ul>
          <li>Traefik logs: <code>docker logs traefik</code></li>
          <li>ACME challenge accessibility</li>
          <li>Let's Encrypt rate limits</li>
        </ul>
      </div>
    `,
  });
  
  console.log(`SSL critical alert sent for ${status.instanceId}`);
}

// =============================================================================
// Public API Functions
// =============================================================================

export async function runHealthCheck(): Promise<HealthSummary> {
  console.log('Running health check for all instances...');
  
  const instances = listInstances().filter(i => i.status === 'active');
  const state = loadHealthState();
  const now = new Date().toISOString();
  
  const statuses: HealthStatus[] = [];
  
  for (const instance of instances) {
    try {
      const newStatus = await checkInstanceHealth(instance);
      const prevStatus = state.statuses[instance.id];
      
      // Track consecutive failures
      if (!newStatus.healthy) {
        newStatus.consecutiveFailures = (prevStatus?.consecutiveFailures || 0) + 1;
      }
      
      // Send alert if status changed or first time unhealthy
      if (prevStatus) {
        if (prevStatus.healthy && !newStatus.healthy) {
          // Just became unhealthy
          await sendHealthAlertEmail(newStatus, instance);
        } else if (!prevStatus.healthy && newStatus.healthy) {
          // Just recovered
          await sendHealthAlertEmail(newStatus, instance);
        }
      } else if (!newStatus.healthy) {
        // First check and unhealthy
        await sendHealthAlertEmail(newStatus, instance);
      }
      
      // Check SSL expiry - only alert if critically low (≤7 days) as backup warning
      // SSL is auto-renewed by Traefik/Let's Encrypt, this is just a safety net
      if (newStatus.sslDaysRemaining !== null && newStatus.sslDaysRemaining <= 7) {
        const lastSSLAlert = state.statuses[instance.id]?.sslExpiresAt;
        if (!lastSSLAlert || lastSSLAlert !== newStatus.sslExpiresAt) {
          await sendSSLExpiryAlertEmail(newStatus, instance);
        }
      }
      
      state.statuses[instance.id] = newStatus;
      statuses.push(newStatus);
      
    } catch (err) {
      console.error(`Health check failed for ${instance.id}:`, err);
    }
  }
  
  state.lastFullCheck = now;
  saveHealthState(state);
  
  const healthyCount = statuses.filter(s => s.healthy).length;
  const sslExpiringCount = statuses.filter(s => s.sslDaysRemaining !== null && s.sslDaysRemaining <= 30).length;
  
  console.log(`Health check complete: ${healthyCount}/${statuses.length} healthy, ${sslExpiringCount} SSL expiring soon`);
  
  return {
    totalInstances: statuses.length,
    healthyInstances: healthyCount,
    unhealthyInstances: statuses.length - healthyCount,
    sslExpiringInstances: sslExpiringCount,
    statuses,
  };
}

export function getHealthSummary(): HealthSummary {
  const state = loadHealthState();
  const statuses = Object.values(state.statuses);
  
  return {
    totalInstances: statuses.length,
    healthyInstances: statuses.filter(s => s.healthy).length,
    unhealthyInstances: statuses.filter(s => !s.healthy).length,
    sslExpiringInstances: statuses.filter(s => s.sslDaysRemaining !== null && s.sslDaysRemaining <= 30).length,
    statuses,
  };
}

export function getInstanceHealth(instanceId: string): HealthStatus | null {
  const state = loadHealthState();
  return state.statuses[instanceId] || null;
}

// =============================================================================
// Instance Management
// =============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { InstanceMetadata, CreateInstanceResult, Plan, Platform } from './types';
import { env, INSTANCES_DIR, EXTERNAL_STORAGE_PATH } from './config';

const execAsync = promisify(exec);

export function generateId(email: string): string {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

export function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function waitForInstance(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/api/server/ping`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        console.log(`Instance ${url} is ready`);
        return true;
      }
    } catch {
      // Instance not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  console.error(`Instance ${url} failed to become ready`);
  return false;
}

export async function setupImmichAdmin(
  instanceUrl: string, 
  email: string, 
  password: string, 
  quotaBytes: number
): Promise<{ success: boolean; apiKey?: string }> {
  try {
    // First, sign up the admin user (first user becomes admin)
    const signUpResponse = await fetch(`${instanceUrl}/api/auth/admin-sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: email.split('@')[0],
      }),
    });

    if (!signUpResponse.ok) {
      const error = await signUpResponse.text();
      console.error('Admin signup failed:', error);
      return { success: false };
    }

    const adminUser = await signUpResponse.json() as { id: string; email: string };
    console.log(`Admin user created: ${adminUser.email}`);

    // Login to get access token
    const loginResponse = await fetch(`${instanceUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!loginResponse.ok) {
      console.error('Admin login failed');
      return { success: false };
    }

    const loginData = await loginResponse.json() as { accessToken: string };
    const { accessToken } = loginData;

    // Set storage quota and force password change
    if (adminUser.id) {
      const updateResponse = await fetch(`${instanceUrl}/api/admin/users/${adminUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          quotaSizeInBytes: quotaBytes,
          shouldChangePassword: true,
        }),
      });

      if (updateResponse.ok) {
        console.log(`Storage quota set to ${quotaBytes} bytes, password change required`);
      } else {
        console.error('Failed to update user settings');
      }
    }

    // Create an API key for admin stats access
    let apiKey: string | undefined;
    try {
      const apiKeyResponse = await fetch(`${instanceUrl}/api/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: 'SPhoto Admin Stats',
        }),
      });

      if (apiKeyResponse.ok) {
        const apiKeyData = await apiKeyResponse.json() as { secret: string };
        apiKey = apiKeyData.secret;
        console.log('API key created for admin stats');
      }
    } catch (err) {
      console.error('Failed to create API key:', err);
    }

    return { success: true, apiKey };
  } catch (err) {
    console.error('Immich setup error:', err);
    return { success: false };
  }
}

// =============================================================================
// Nextcloud Setup
// =============================================================================

export async function waitForNextcloud(url: string, maxAttempts = 45): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/status.php`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const data = await response.json() as { installed: boolean };
        if (data.installed) {
          console.log(`Nextcloud ${url} is ready`);
          return true;
        }
      }
    } catch {
      // Instance not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  console.error(`Nextcloud ${url} failed to become ready`);
  return false;
}

export async function setupNextcloudAdmin(
  instanceUrl: string, 
  adminUser: string,
  adminPass: string,
  email: string, 
  quotaGB: number,
  containerId?: string
): Promise<{ success: boolean }> {
  try {
    // Wait extra time for Nextcloud to fully initialize after status.php is ready
    console.log('Waiting 15s for Nextcloud to fully initialize...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Try using OCC command via docker exec (more reliable)
    if (containerId) {
      try {
        const quotaBytes = BigInt(quotaGB) * BigInt(1024) * BigInt(1024) * BigInt(1024);
        
        // Set quota via occ
        await execAsync(`docker exec -u www-data ${containerId} php occ user:setting ${adminUser} files quota "${quotaBytes.toString()}"`);
        console.log(`Nextcloud quota set via OCC: ${quotaGB} GB (${quotaBytes} bytes)`);
        
        // Set email via occ  
        await execAsync(`docker exec -u www-data ${containerId} php occ user:setting ${adminUser} settings email "${email}"`);
        console.log(`Nextcloud email set via OCC: ${email}`);
        
        return { success: true };
      } catch (occErr) {
        console.error('OCC command failed, falling back to API:', occErr);
      }
    }
    
    // Fallback: Use OCS REST API
    const authHeader = 'Basic ' + Buffer.from(`${adminUser}:${adminPass}`).toString('base64');
    
    // Set email
    const emailRes = await fetch(`${instanceUrl}/ocs/v1.php/cloud/users/${adminUser}`, {
      method: 'PUT',
      headers: {
        'OCS-APIRequest': 'true',
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `key=email&value=${encodeURIComponent(email)}`,
    });
    
    if (!emailRes.ok) {
      const errText = await emailRes.text().catch(() => '');
      console.error(`Failed to set Nextcloud email: ${emailRes.status} - ${errText}`);
    }
    
    // Set quota - use BigInt to handle large numbers safely, then convert to string
    const quotaBytes = BigInt(quotaGB) * BigInt(1024) * BigInt(1024) * BigInt(1024);
    const quotaRes = await fetch(`${instanceUrl}/ocs/v1.php/cloud/users/${adminUser}`, {
      method: 'PUT',
      headers: {
        'OCS-APIRequest': 'true',
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `key=quota&value=${quotaBytes.toString()}`,
    });
    
    if (!quotaRes.ok) {
      const errorText = await quotaRes.text().catch(() => 'unknown');
      console.error(`Failed to set Nextcloud quota via API: ${quotaRes.status} - ${errorText}`);
    } else {
      console.log(`Nextcloud quota set via API: ${quotaGB} GB (${quotaBytes} bytes)`);
    }
    
    console.log(`Nextcloud admin user configured: ${adminUser}`);
    return { success: true };
  } catch (err) {
    console.error('Nextcloud setup error:', err);
    return { success: false };
  }
}

function generateNextcloudCompose(
  id: string,
  dbPass: string,
  adminUser: string,
  adminPass: string,
  uploadsVolume: string
): string {
  return `
name: sphoto-${id}

services:
  app:
    image: nextcloud:stable
    container_name: sphoto-${id}-app
    environment:
      - POSTGRES_HOST=db
      - POSTGRES_DB=nextcloud
      - POSTGRES_USER=nextcloud
      - POSTGRES_PASSWORD=${dbPass}
      - REDIS_HOST=redis
      - NEXTCLOUD_ADMIN_USER=${adminUser}
      - NEXTCLOUD_ADMIN_PASSWORD=${adminPass}
      - NEXTCLOUD_TRUSTED_DOMAINS=${id}.${env.DOMAIN}
      - OVERWRITEPROTOCOL=https
      - OVERWRITEHOST=${id}.${env.DOMAIN}
    volumes:
      - ${uploadsVolume}
      - ./config:/var/www/html/config
    depends_on:
      - db
      - redis
    restart: unless-stopped
    networks:
      - sphoto-net
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${id}.rule=Host(\`${id}.${env.DOMAIN}\`)"
      - "traefik.http.routers.${id}.entrypoints=websecure"
      - "traefik.http.routers.${id}.tls.certresolver=le"
      - "traefik.http.services.${id}.loadbalancer.server.port=80"

  db:
    image: postgres:15-alpine
    container_name: sphoto-${id}-db
    environment:
      - POSTGRES_PASSWORD=${dbPass}
      - POSTGRES_USER=nextcloud
      - POSTGRES_DB=nextcloud
    volumes:
      - ./db:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - internal

  redis:
    image: redis:alpine
    container_name: sphoto-${id}-redis
    restart: unless-stopped
    networks:
      - internal

networks:
  sphoto-net:
    external: true
  internal:
`;
}

function generateImmichCompose(
  id: string,
  dbPass: string,
  uploadsVolume: string
): string {
  return `
name: sphoto-${id}

services:
  server:
    image: ghcr.io/immich-app/immich-server:\${IMMICH_VERSION:-release}
    container_name: sphoto-${id}-server
    environment:
      - DB_URL=postgresql://sphoto:${dbPass}@db:5432/sphoto
      - REDIS_HOSTNAME=redis
      - MACHINE_LEARNING_URL=http://sphoto-ml:3003
    volumes:
      - ${uploadsVolume}
    depends_on:
      - db
      - redis
    restart: unless-stopped
    networks:
      - sphoto-net
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${id}.rule=Host(\`${id}.${env.DOMAIN}\`)"
      - "traefik.http.routers.${id}.entrypoints=websecure"
      - "traefik.http.routers.${id}.tls.certresolver=le"
      - "traefik.http.services.${id}.loadbalancer.server.port=2283"

  db:
    image: ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0
    container_name: sphoto-${id}-db
    environment:
      - POSTGRES_PASSWORD=${dbPass}
      - POSTGRES_USER=sphoto
      - POSTGRES_DB=sphoto
    volumes:
      - ./db:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - internal

  redis:
    image: valkey/valkey:9
    container_name: sphoto-${id}-redis
    restart: unless-stopped
    networks:
      - internal

networks:
  sphoto-net:
    external: true
  internal:
`;
}

// =============================================================================
// Main Instance Creation
// =============================================================================

export async function createInstance(
  id: string, 
  email: string, 
  plan: Plan,
  platform: Platform = 'immich'
): Promise<CreateInstanceResult> {
  console.log(`Creating ${platform} instance: ${id} for ${email}`);
  
  const dir = join(INSTANCES_DIR, id);
  
  // Determine upload path: external storage or local
  let uploadsPath: string;
  let uploadsVolume: string;
  
  if (EXTERNAL_STORAGE_PATH) {
    uploadsPath = join(EXTERNAL_STORAGE_PATH, id, 'uploads');
    uploadsVolume = `${uploadsPath}:/data`;
    if (platform === 'nextcloud') {
      uploadsVolume = `${uploadsPath}:/var/www/html/data`;
    }
    mkdirSync(uploadsPath, { recursive: true });
    console.log(`Using external storage: ${uploadsPath}`);
  } else {
    uploadsPath = join(dir, 'uploads');
    uploadsVolume = './uploads:/data';
    if (platform === 'nextcloud') {
      uploadsVolume = './uploads:/var/www/html/data';
    }
    mkdirSync(uploadsPath, { recursive: true });
  }
  
  mkdirSync(join(dir, 'db'), { recursive: true });
  if (platform === 'nextcloud') {
    mkdirSync(join(dir, 'config'), { recursive: true });
  }

  const dbPass = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const userPassword = generatePassword();
  const quotaBytes = plan.storage * 1024 * 1024 * 1024;
  
  // Generate admin username for Nextcloud
  const adminUser = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'admin';

  // Generate compose file based on platform
  let compose: string;
  if (platform === 'nextcloud') {
    compose = generateNextcloudCompose(id, dbPass, adminUser, userPassword, uploadsVolume);
  } else {
    compose = generateImmichCompose(id, dbPass, uploadsVolume);
  }

  writeFileSync(join(dir, 'docker-compose.yml'), compose);
  
  const metadata: InstanceMetadata = {
    id, 
    email, 
    plan: plan.name, 
    storage_gb: plan.storage,
    platform,
    created: new Date().toISOString(), 
    status: 'active'
  };
  
  if (platform === 'nextcloud') {
    metadata.nextcloudAdminUser = adminUser;
  }
  
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  await execAsync(`cd ${dir} && docker compose up -d`);
  console.log(`Instance ${id} containers started`);

  const instanceUrl = `https://${id}.${env.DOMAIN}`;
  
  if (platform === 'nextcloud') {
    const isReady = await waitForNextcloud(instanceUrl);
    const containerId = `${id}-app`; // Nextcloud app container name
    
    if (isReady) {
      const setupResult = await setupNextcloudAdmin(instanceUrl, adminUser, userPassword, email, plan.storage, containerId);
      if (setupResult.success) {
        const metaPath = join(dir, 'metadata.json');
        const meta: InstanceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
        meta.initialPassword = userPassword;
        writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        console.log(`Nextcloud instance ${id} fully configured`);
        return { success: true, password: userPassword };
      }
    }
  } else {
    // Immich
    const isReady = await waitForInstance(instanceUrl);
    
    if (isReady) {
      const setupResult = await setupImmichAdmin(instanceUrl, email, userPassword, quotaBytes);
      if (setupResult.success) {
        const metaPath = join(dir, 'metadata.json');
        const meta: InstanceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
        meta.initialPassword = userPassword;
        if (setupResult.apiKey) {
          meta.immichApiKey = setupResult.apiKey;
        }
        writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        console.log(`Immich instance ${id} fully configured`);
        return { success: true, password: userPassword };
      }
    }
  }
  
  console.log(`Instance ${id} created but auto-setup failed - manual setup required`);
  return { success: false, password: null };
}

export async function stopInstance(id: string): Promise<void> {
  const dir = join(INSTANCES_DIR, id);
  if (!existsSync(dir)) return;

  await execAsync(`cd ${dir} && docker compose down`);
  
  const metaPath = join(dir, 'metadata.json');
  const meta: InstanceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
  meta.status = 'stopped';
  meta.stopped_at = new Date().toISOString();
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  
  console.log(`Instance ${id} stopped`);
}

export async function startInstance(id: string): Promise<void> {
  const dir = join(INSTANCES_DIR, id);
  if (!existsSync(dir)) throw new Error('Instance not found');

  await execAsync(`cd ${dir} && docker compose up -d`);
  
  const metaPath = join(dir, 'metadata.json');
  const meta: InstanceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
  meta.status = 'active';
  delete meta.stopped_at;
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  
  console.log(`Instance ${id} started`);
}

export async function deleteInstance(id: string): Promise<void> {
  const dir = join(INSTANCES_DIR, id);
  if (!existsSync(dir)) return;

  await execAsync(`cd ${dir} && docker compose down -v`);
  await rm(dir, { recursive: true, force: true });
  
  console.log(`Instance ${id} deleted`);
}

export function listInstances(): InstanceMetadata[] {
  if (!existsSync(INSTANCES_DIR)) return [];
  
  return readdirSync(INSTANCES_DIR)
    .filter(d => existsSync(join(INSTANCES_DIR, d, 'metadata.json')))
    .map(d => JSON.parse(readFileSync(join(INSTANCES_DIR, d, 'metadata.json'), 'utf-8')));
}

export function getInstance(id: string): InstanceMetadata | null {
  const metaPath = join(INSTANCES_DIR, id, 'metadata.json');
  if (!existsSync(metaPath)) return null;
  return JSON.parse(readFileSync(metaPath, 'utf-8'));
}

export async function getDirectorySize(dirPath: string): Promise<number> {
  const { stat, readdir } = await import('fs/promises');
  
  let totalSize = 0;
  
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
          } catch {
            // Skip files we can't access
          }
        }
      }
    } catch {
      // Skip directories we can't access
    }
  }
  
  await walkDir(dirPath);
  return totalSize;
}

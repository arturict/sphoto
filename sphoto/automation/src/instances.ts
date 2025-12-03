// =============================================================================
// Instance Management
// =============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { rm } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { InstanceMetadata, CreateInstanceResult, Plan } from './types';
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

export async function createInstance(
  id: string, 
  email: string, 
  plan: Plan
): Promise<CreateInstanceResult> {
  console.log(`Creating instance: ${id} for ${email}`);
  
  const dir = join(INSTANCES_DIR, id);
  
  // Determine upload path: external storage or local
  let uploadsPath: string;
  let uploadsVolume: string;
  
  if (EXTERNAL_STORAGE_PATH) {
    // Use external storage (NAS/HDD)
    uploadsPath = join(EXTERNAL_STORAGE_PATH, id, 'uploads');
    uploadsVolume = `${uploadsPath}:/data`;
    mkdirSync(uploadsPath, { recursive: true });
    console.log(`Using external storage: ${uploadsPath}`);
  } else {
    // Use local storage (default)
    uploadsPath = join(dir, 'uploads');
    uploadsVolume = './uploads:/data';
    mkdirSync(uploadsPath, { recursive: true });
  }
  
  mkdirSync(join(dir, 'db'), { recursive: true });

  const dbPass = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const userPassword = generatePassword();
  const quotaBytes = plan.storage * 1024 * 1024 * 1024;

  const compose = `
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

  writeFileSync(join(dir, 'docker-compose.yml'), compose);
  
  const metadata: InstanceMetadata = {
    id, 
    email, 
    plan: plan.name, 
    storage_gb: plan.storage,
    created: new Date().toISOString(), 
    status: 'active'
  };
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  await execAsync(`cd ${dir} && docker compose up -d`);
  console.log(`Instance ${id} containers started`);

  const instanceUrl = `https://${id}.${env.DOMAIN}`;
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
      console.log(`Instance ${id} fully configured`);
      return { success: true, password: userPassword };
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

// =============================================================================
// Configuration
// =============================================================================

import type { Plans, Env } from './types';

export const env: Env = {
  DOMAIN: process.env.DOMAIN || 'localhost',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PRICE_BASIC: process.env.STRIPE_PRICE_BASIC || '',
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO || '',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'SPhoto <noreply@sphoto.local>',
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || '',
  IMMICH_VERSION: process.env.IMMICH_VERSION || 'release',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@sphoto.local',
};

// Support email for user communications
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || `support@${env.DOMAIN}`;

export const INSTANCES_DIR = process.env.INSTANCES_DIR || '/data/instances';

// External storage path for media files (photos/videos)
// If not set, media is stored locally in each instance's uploads folder
// Example: /mnt/nas/sphoto or /mnt/hdd/sphoto
export const EXTERNAL_STORAGE_PATH = process.env.EXTERNAL_STORAGE_PATH || '';

// Coolify mode: use 'coolify' network instead of 'sphoto-net'
// and use Coolify's Traefik labels format
export const COOLIFY_MODE = process.env.COOLIFY_MODE === 'true';

// Network name based on mode
export const NETWORK_NAME = COOLIFY_MODE ? 'coolify' : 'sphoto-net';

// =============================================================================
// Local Development Detection
// =============================================================================
export const IS_LOCAL_DEV = env.DOMAIN === 'localhost' || env.DOMAIN.startsWith('localhost:');

// =============================================================================
// Deployment Mode Configuration
// =============================================================================
// 'siloed' = One instance per user (original behavior)
// 'shared' = Two shared instances (free + paid)
export type DeploymentMode = 'siloed' | 'shared';
export const DEPLOYMENT_MODE: DeploymentMode = (process.env.DEPLOYMENT_MODE as DeploymentMode) || 'shared';

// Shared instance configuration (used when DEPLOYMENT_MODE = 'shared')
// For local dev, use localhost:port URLs; for production use https://subdomain.domain
export const SHARED_INSTANCES = {
  free: {
    subdomain: 'free',
    url: IS_LOCAL_DEV ? 'http://localhost:2283' : `https://free.${env.DOMAIN}`,
    internalUrl: process.env.SHARED_FREE_INTERNAL_URL || `http://sphoto-free-server:2283`,
    apiKey: process.env.SHARED_FREE_API_KEY || '',
    hasML: false,
    defaultQuotaGB: 5,
  },
  paid: {
    subdomain: 'photos',
    url: IS_LOCAL_DEV ? 'http://localhost:2284' : `https://photos.${env.DOMAIN}`,
    internalUrl: process.env.SHARED_PAID_INTERNAL_URL || `http://sphoto-paid-server:2283`,
    apiKey: process.env.SHARED_PAID_API_KEY || '',
    hasML: true,
    defaultQuotaGB: 200, // Basic plan default
  },
};

// Free tier configuration
export const FREE_TIER = {
  quotaGB: 5,
  name: 'Free',
};

export const PLANS: Plans = {
  [env.STRIPE_PRICE_BASIC]: { name: 'Basic', storage: 200 },
  [env.STRIPE_PRICE_PRO]: { name: 'Pro', storage: 1000 },
};

export const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'stats', 'mail', 'smtp', 
  'ftp', 'ssh', 'test', 'dev', 'staging', 'app',
  'free', 'photos', 'pro', 'paid' // Reserved for shared instances
];

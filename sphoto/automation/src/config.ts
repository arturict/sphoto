// =============================================================================
// Configuration
// =============================================================================

import type { Plans, Env } from './types';

export const env: Env = {
  DOMAIN: process.env.DOMAIN || 'sphoto.arturf.ch',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PRICE_BASIC: process.env.STRIPE_PRICE_BASIC || '',
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO || '',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'SPhoto <noreply@arturf.ch>',
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || '',
  IMMICH_VERSION: process.env.IMMICH_VERSION || 'release',
};

export const INSTANCES_DIR = '/data/instances';

// External storage path for media files (photos/videos)
// If not set, media is stored locally in each instance's uploads folder
// Example: /mnt/nas/sphoto or /mnt/hdd/sphoto
export const EXTERNAL_STORAGE_PATH = process.env.EXTERNAL_STORAGE_PATH || '';

export const PLANS: Plans = {
  [env.STRIPE_PRICE_BASIC]: { name: 'Basic', storage: 200 },
  [env.STRIPE_PRICE_PRO]: { name: 'Pro', storage: 1000 },
};

export const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'stats', 'mail', 'smtp', 
  'ftp', 'ssh', 'test', 'dev', 'staging', 'app'
];

// =============================================================================
// Type Definitions
// =============================================================================

export type Platform = 'immich' | 'nextcloud';

export interface Plan {
  name: string;
  storage: number; // in GB
}

export interface Plans {
  [priceId: string]: Plan;
}

export interface BrandingSettings {
  logo_url?: string;
  primary_color?: string;
  welcome_message?: string;
  favicon_url?: string;
  app_name?: string;
}

export interface InstanceMetadata {
  id: string;
  email: string;
  plan: string;
  storage_gb: number;
  platform: Platform;
  created: string;
  status: 'active' | 'stopped' | 'deleted';
  initialPassword?: string;
  stopped_at?: string;
  immichApiKey?: string;
  nextcloudAdminUser?: string;
  branding?: BrandingSettings;
}

export interface ExportJob {
  id: string;
  instanceId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created: string;
  completed?: string;
  downloadToken?: string;
  expiresAt?: string;
  error?: string;
  fileSize?: number;
}

export interface CreateInstanceResult {
  success: boolean;
  password: string | null;
}

export interface SessionStatus {
  status: 'processing' | 'complete' | 'error' | 'pending' | 'unknown';
  message?: string;
  instanceId?: string;
  instanceUrl?: string;
  email?: string;
  plan?: string;
  platform?: Platform;
  autoSetup?: boolean;
}

export interface SubdomainCheckResult {
  available: boolean;
  subdomain?: string;
  reason?: string;
}

export interface ImmichAdminUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface ImmichLoginResponse {
  accessToken: string;
  userId: string;
  userEmail: string;
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: {
      id: string;
      mode?: string;
      customer_email?: string;
      customer?: string;
      subscription?: string;
      metadata?: Record<string, string>;
    };
  };
}

export interface Env {
  DOMAIN: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_BASIC: string;
  STRIPE_PRICE_PRO: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  ADMIN_API_KEY: string;
  IMMICH_VERSION: string;
  ADMIN_EMAIL: string;
}

export interface DailyStats {
  date: string;
  instances: Record<string, {
    storage_bytes: number;
    files: number;
  }>;
}

export interface AnalyticsData {
  uploadTrend: Array<{ date: string; uploads: number }>;
  storageGrowth: Array<{ date: string; total_bytes: number }>;
  activeInstances: number;
  inactiveInstances: number;
  topInstances: Array<{ id: string; storage_bytes: number; files: number }>;
  churnRisk: Array<{ id: string; lastActivity: string }>;
}

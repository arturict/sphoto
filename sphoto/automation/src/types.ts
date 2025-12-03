// =============================================================================
// Type Definitions
// =============================================================================

export interface Plan {
  name: string;
  storage: number; // in GB
}

export interface Plans {
  [priceId: string]: Plan;
}

export interface InstanceMetadata {
  id: string;
  email: string;
  plan: string;
  storage_gb: number;
  created: string;
  status: 'active' | 'stopped' | 'deleted';
  initialPassword?: string;
  stopped_at?: string;
  immichApiKey?: string;
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
}

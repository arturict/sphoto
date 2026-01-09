// =============================================================================
// Config Tests
// =============================================================================

import { describe, expect, test } from 'bun:test';
import { 
  env, 
  PLANS, 
  RESERVED_SUBDOMAINS, 
  FREE_TIER, 
  SHARED_INSTANCES,
  IS_LOCAL_DEV,
  DEPLOYMENT_MODE,
  SUPPORT_EMAIL,
} from '../config';

describe('env configuration', () => {
  test('has all required fields', () => {
    expect(env).toHaveProperty('DOMAIN');
    expect(env).toHaveProperty('STRIPE_SECRET_KEY');
    expect(env).toHaveProperty('STRIPE_WEBHOOK_SECRET');
    expect(env).toHaveProperty('STRIPE_PRICE_BASIC');
    expect(env).toHaveProperty('STRIPE_PRICE_PRO');
    expect(env).toHaveProperty('RESEND_API_KEY');
    expect(env).toHaveProperty('EMAIL_FROM');
    expect(env).toHaveProperty('ADMIN_API_KEY');
    expect(env).toHaveProperty('IMMICH_VERSION');
    expect(env).toHaveProperty('ADMIN_EMAIL');
  });

  test('has default values for optional fields', () => {
    // These should have defaults even when env vars are not set
    expect(typeof env.DOMAIN).toBe('string');
    expect(typeof env.EMAIL_FROM).toBe('string');
    expect(typeof env.IMMICH_VERSION).toBe('string');
  });
});

describe('PLANS configuration', () => {
  test('is an object', () => {
    expect(typeof PLANS).toBe('object');
  });

  test('plan entries have name and storage', () => {
    for (const [priceId, plan] of Object.entries(PLANS)) {
      if (priceId) {  // Skip empty price IDs (from default env)
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('storage');
        expect(typeof plan.name).toBe('string');
        expect(typeof plan.storage).toBe('number');
      }
    }
  });
});

describe('FREE_TIER configuration', () => {
  test('has correct quota', () => {
    expect(FREE_TIER.quotaGB).toBe(5);
  });

  test('has name', () => {
    expect(FREE_TIER.name).toBe('Free');
  });
});

describe('SHARED_INSTANCES configuration', () => {
  test('has free and paid instances', () => {
    expect(SHARED_INSTANCES).toHaveProperty('free');
    expect(SHARED_INSTANCES).toHaveProperty('paid');
  });

  test('free instance has required properties', () => {
    const free = SHARED_INSTANCES.free;
    expect(free).toHaveProperty('subdomain');
    expect(free).toHaveProperty('url');
    expect(free).toHaveProperty('internalUrl');
    expect(free).toHaveProperty('apiKey');
    expect(free).toHaveProperty('hasML');
    expect(free).toHaveProperty('defaultQuotaGB');
  });

  test('paid instance has required properties', () => {
    const paid = SHARED_INSTANCES.paid;
    expect(paid).toHaveProperty('subdomain');
    expect(paid).toHaveProperty('url');
    expect(paid).toHaveProperty('internalUrl');
    expect(paid).toHaveProperty('apiKey');
    expect(paid).toHaveProperty('hasML');
    expect(paid).toHaveProperty('defaultQuotaGB');
  });

  test('free instance has ML disabled', () => {
    expect(SHARED_INSTANCES.free.hasML).toBe(false);
  });

  test('paid instance has ML enabled', () => {
    expect(SHARED_INSTANCES.paid.hasML).toBe(true);
  });

  test('free instance has 5GB quota', () => {
    expect(SHARED_INSTANCES.free.defaultQuotaGB).toBe(5);
  });

  test('paid instance has 200GB quota (Basic plan default)', () => {
    expect(SHARED_INSTANCES.paid.defaultQuotaGB).toBe(200);
  });
});

describe('RESERVED_SUBDOMAINS', () => {
  test('is an array', () => {
    expect(Array.isArray(RESERVED_SUBDOMAINS)).toBe(true);
  });

  test('has reasonable length', () => {
    expect(RESERVED_SUBDOMAINS.length).toBeGreaterThan(5);
    expect(RESERVED_SUBDOMAINS.length).toBeLessThan(100);
  });

  test('all entries are strings', () => {
    for (const subdomain of RESERVED_SUBDOMAINS) {
      expect(typeof subdomain).toBe('string');
    }
  });

  test('all entries are lowercase', () => {
    for (const subdomain of RESERVED_SUBDOMAINS) {
      expect(subdomain).toBe(subdomain.toLowerCase());
    }
  });
});

describe('IS_LOCAL_DEV detection', () => {
  test('is a boolean', () => {
    expect(typeof IS_LOCAL_DEV).toBe('boolean');
  });

  test('is true when domain is localhost', () => {
    // This tests the current env - may vary based on environment
    if (env.DOMAIN === 'localhost' || env.DOMAIN.startsWith('localhost:')) {
      expect(IS_LOCAL_DEV).toBe(true);
    }
  });
});

describe('DEPLOYMENT_MODE', () => {
  test('is either siloed or shared', () => {
    expect(['siloed', 'shared']).toContain(DEPLOYMENT_MODE);
  });
});

describe('SUPPORT_EMAIL', () => {
  test('is a string', () => {
    expect(typeof SUPPORT_EMAIL).toBe('string');
  });

  test('looks like an email', () => {
    expect(SUPPORT_EMAIL).toContain('@');
  });
});

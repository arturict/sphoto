// =============================================================================
// SPhoto Automation Server - TypeScript/Bun
// =============================================================================

import express, { type Request, type Response, type NextFunction } from 'express';
import Stripe from 'stripe';
import { env, DEPLOYMENT_MODE, SHARED_INSTANCES, FREE_TIER } from './config';
import { handleWebhook, getSessionStatus, createCheckoutSession } from './stripe';
import { checkSubdomain } from './subdomain';
import { listInstances, getInstance, startInstance, stopInstance, deleteInstance, migrateInstanceStorage, getInstanceStoragePath } from './instances';
import { getBranding, updateBranding, deleteBranding, generateCustomCss } from './branding';
import { startExport, getExportJob, getExportByToken, listExportJobs, cleanupExpiredExports } from './export';
import { getAnalytics, runDailyStatsCollection } from './analytics';
import { sendExportReadyEmail, sendFreeWelcomeEmail, sendAccountDeletionEmail, sendAccountDeletionCancelledEmail } from './email';
import {
  createSharedUser,
  getSharedUser,
  getSharedUserByEmail,
  listSharedUsers,
  updateSharedUserQuota,
  updateSharedUserTier,
  deleteSharedUser,
  migrateUserBetweenInstances,
  getSharedUserStats,
  checkSharedInstanceHealth,
  getSharedInstanceStats,
  requestAccountDeletion,
  cancelAccountDeletion,
  processScheduledDeletions,
  listPendingDeletions,
  createPortalSession,
  validatePortalToken,
  invalidatePortalToken,
  getPortalData,
} from './shared-users';
import { 
  getAlertHistory, 
  updateAlertSettings, 
  checkInstanceAlerts, 
  runAlertCheck, 
  sendTestAlert, 
  getActiveAlerts,
  type AlertType 
} from './alerts';
import {
  getPlanInfo,
  checkDowngradePossible,
  upgradePlan,
  downgradePlan,
} from './plan-migration';
import {
  listMaintenances,
  getMaintenance,
  createMaintenance,
  updateMaintenance,
  cancelMaintenance,
  startMaintenance,
  completeMaintenance,
  getPublicStatus,
  checkMaintenanceNotifications,
  type MaintenanceCreateInput,
} from './maintenance';
import {
  runHealthCheck,
  getHealthSummary,
  getInstanceHealth,
} from './health';
import type { BrandingSettings, UserTier } from './types';

const app = express();
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// =============================================================================
// CORS Middleware
// =============================================================================
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// =============================================================================
// Routes
// =============================================================================

// Stripe webhook (needs raw body)
app.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// JSON parser for other routes
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    deploymentMode: DEPLOYMENT_MODE,
  });
});

// =============================================================================
// Free Tier Signup (Public - no auth needed)
// =============================================================================
app.post('/signup/free', async (req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Free tier only available in shared mode' });
  }

  const { email } = req.body;
  
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Basic email validation
  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Check if user already exists
  const existing = getSharedUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  try {
    const result = await createSharedUser(email, 'free', FREE_TIER.quotaGB);
    
    if (!result.success || !result.user) {
      return res.status(500).json({ error: result.error || 'Failed to create account' });
    }

    // Send welcome email
    if (result.password) {
      await sendFreeWelcomeEmail(email, result.password);
    }

    res.status(201).json({
      success: true,
      message: 'Account created! Check your email for login details.',
      instanceUrl: SHARED_INSTANCES.free.url,
    });
  } catch (err) {
    console.error('Free signup error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// =============================================================================
// User Portal API (authenticated with portal token)
// =============================================================================

// Portal auth middleware
const portalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  const user = validatePortalToken(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Attach user to request
  (req as any).portalUser = user;
  next();
};

// Login to portal (sends magic link via email)
app.post('/portal/login', async (req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Portal only available in shared mode' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = getSharedUserByEmail(email);
  if (!user) {
    // Don't reveal if email exists - just say "check your email"
    return res.json({ success: true, message: 'If your account exists, check your email for login link.' });
  }

  const session = createPortalSession(user.visibleId);
  if (!session.success || !session.token) {
    return res.status(500).json({ error: 'Failed to create session' });
  }

  // TODO: Send magic link email
  // For now, return token directly (development mode)
  // In production, send email with: https://portal.sphoto.arturf.ch/auth?token=xxx
  
  // Send magic link email
  const { sendPortalLoginEmail } = await import('./email');
  await sendPortalLoginEmail(email, session.token);

  res.json({ 
    success: true, 
    message: 'Check your email for login link.',
    // Remove in production:
    _devToken: process.env.NODE_ENV === 'development' ? session.token : undefined,
  });
});

// Validate token and get user data
app.post('/portal/auth', async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  const user = validatePortalToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  res.json({ 
    success: true, 
    token,
    userId: user.visibleId,
  });
});

// Get portal dashboard data
app.get('/portal/dashboard', portalAuth, async (req: Request, res: Response) => {
  const user = (req as any).portalUser;
  
  const result = await getPortalData(user.visibleId);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json(result.data);
});

// Get Stripe Customer Portal URL
app.get('/portal/billing', portalAuth, async (req: Request, res: Response) => {
  const user = (req as any).portalUser;

  if (!user.stripeCustomerId) {
    return res.status(400).json({ 
      error: 'No billing account linked',
      canUpgrade: user.tier === 'free',
    });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `https://portal.${env.DOMAIN}`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal error:', err);
    res.status(500).json({ error: 'Failed to create billing session' });
  }
});

// Request account deletion (2-week delay)
app.post('/portal/delete-account', portalAuth, async (req: Request, res: Response) => {
  const user = (req as any).portalUser;

  const result = requestAccountDeletion(user.visibleId);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  // Send confirmation email
  await sendAccountDeletionEmail(user.email, result.scheduledFor!);

  res.json({
    success: true,
    message: 'Account deletion scheduled',
    scheduledFor: result.scheduledFor,
  });
});

// Cancel account deletion
app.post('/portal/cancel-deletion', portalAuth, async (req: Request, res: Response) => {
  const user = (req as any).portalUser;

  const result = cancelAccountDeletion(user.visibleId);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  // Send confirmation email
  await sendAccountDeletionCancelledEmail(user.email);

  res.json({ success: true, message: 'Account deletion cancelled' });
});

// Logout
app.post('/portal/logout', portalAuth, (req: Request, res: Response) => {
  const user = (req as any).portalUser;
  invalidatePortalToken(user.visibleId);
  res.json({ success: true });
});

// =============================================================================
// Subdomain API
// =============================================================================
app.get('/subdomain/check/:subdomain', (req: Request, res: Response) => {
  const result = checkSubdomain(req.params.subdomain);
  res.json(result);
});

// =============================================================================
// Checkout
// =============================================================================
app.get('/checkout/:plan', async (req: Request, res: Response) => {
  const plan = req.params.plan as 'basic' | 'pro';
  const subdomain = (req.query.subdomain as string)?.toLowerCase();
  const platform = (req.query.platform as 'immich' | 'nextcloud') || 'immich';
  
  // Validate platform
  if (!['immich', 'nextcloud'].includes(platform)) {
    return res.status(400).send('Ungültige Plattform');
  }
  
  // Validate subdomain if provided
  if (subdomain) {
    const subdomainCheck = checkSubdomain(subdomain);
    if (!subdomainCheck.available) {
      return res.status(400).send(subdomainCheck.reason || 'Subdomain nicht verfügbar');
    }
  }
  
  try {
    const url = await createCheckoutSession(plan, subdomain, platform);
    res.redirect(303, url);
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).send('Checkout failed');
  }
});

// =============================================================================
// Status API
// =============================================================================
app.get('/status/:sessionId', async (req: Request, res: Response) => {
  const status = await getSessionStatus(req.params.sessionId);
  res.json(status);
});

// =============================================================================
// Admin API (protected)
// =============================================================================
const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.headers['x-api-key'] !== env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.get('/api/instances', adminAuth, (_req: Request, res: Response) => {
  res.json(listInstances());
});

app.get('/api/instances/:id', adminAuth, (req: Request, res: Response) => {
  const instance = getInstance(req.params.id);
  if (!instance) {
    return res.status(404).json({ error: 'Instance not found' });
  }
  res.json(instance);
});

app.post('/api/instances/:id/start', adminAuth, async (req: Request, res: Response) => {
  try {
    await startInstance(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/instances/:id/stop', adminAuth, async (req: Request, res: Response) => {
  try {
    await stopInstance(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/instances/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    await deleteInstance(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Generate API Key for existing instance (one-time setup)
// =============================================================================
app.post('/api/instances/:id/generate-api-key', adminAuth, async (req: Request, res: Response) => {
  try {
    const instanceId = req.params.id;
    const { existsSync, readFileSync, writeFileSync } = await import('fs');
    const { join } = await import('path');
    
    const metaPath = join('/data/instances', instanceId, 'metadata.json');
    if (!existsSync(metaPath)) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
    
    // Check if already has API key
    if (meta.immichApiKey) {
      return res.json({ success: true, message: 'API key already exists' });
    }
    
    // Need email and password to login and create API key
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const instanceUrl = `https://${instanceId}.${env.DOMAIN}`;
    
    // Login
    const loginRes = await fetch(`${instanceUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!loginRes.ok) {
      return res.status(401).json({ error: 'Login failed' });
    }
    
    const { accessToken } = await loginRes.json() as { accessToken: string };
    
    // Create API key
    const apiKeyRes = await fetch(`${instanceUrl}/api/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: 'SPhoto Admin Stats' }),
    });
    
    if (!apiKeyRes.ok) {
      return res.status(500).json({ error: 'Failed to create API key' });
    }
    
    const { secret } = await apiKeyRes.json() as { secret: string };
    
    // Save to metadata
    meta.immichApiKey = secret;
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    
    res.json({ success: true, message: 'API key generated and saved' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Instance Statistics (via filesystem - no API key needed)
// =============================================================================
app.get('/api/instances/:id/stats', adminAuth, async (req: Request, res: Response) => {
  try {
    const instanceId = req.params.id;
    const { existsSync } = await import('fs');
    const { getDirectorySize } = await import('./instances');
    
    // Use the helper function that respects per-instance storage paths
    const uploadsPath = await getInstanceStoragePath(instanceId);
    
    if (!uploadsPath || !existsSync(uploadsPath)) {
      return res.json({ 
        usage: 0, 
        photos: 0, 
        videos: 0,
        usageByUser: [],
        storagePath: uploadsPath || 'not configured'
      });
    }
    
    const usage = await getDirectorySize(uploadsPath);
    
    res.json({ 
      usage, 
      photos: 0, // Can't determine without API
      videos: 0, // Can't determine without API
      usageByUser: [],
      storagePath: uploadsPath
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Storage Management API
// =============================================================================
app.get('/api/instances/:id/storage', adminAuth, async (req: Request, res: Response) => {
  try {
    const instance = getInstance(req.params.id);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    const currentPath = await getInstanceStoragePath(req.params.id);
    const { getDirectorySize } = await import('./instances');
    const { existsSync } = await import('fs');
    
    let usage = 0;
    if (currentPath && existsSync(currentPath)) {
      usage = await getDirectorySize(currentPath);
    }
    
    res.json({
      instanceId: req.params.id,
      platform: instance.platform,
      storagePath: currentPath,
      customPath: instance.storagePath || null,
      usageBytes: usage,
      usageGB: Math.round(usage / (1024 * 1024 * 1024) * 100) / 100,
      quotaGB: instance.storage_gb
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/instances/:id/storage/migrate', adminAuth, async (req: Request, res: Response) => {
  try {
    const { newStoragePath } = req.body;
    
    if (!newStoragePath || typeof newStoragePath !== 'string') {
      return res.status(400).json({ error: 'newStoragePath is required' });
    }
    
    // Validate path format (must be absolute)
    if (!newStoragePath.startsWith('/')) {
      return res.status(400).json({ error: 'Storage path must be absolute (start with /)' });
    }
    
    const result = await migrateInstanceStorage(req.params.id, newStoragePath);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Shared Users API (for 2-instance deployment mode)
// =============================================================================
app.get('/api/shared/users', adminAuth, (_req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }
  res.json(listSharedUsers());
});

app.get('/api/shared/users/:id', adminAuth, (req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }
  
  const user = getSharedUser(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

app.post('/api/shared/users', adminAuth, async (req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }

  const { email, tier, quotaGB } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const validTiers: UserTier[] = ['free', 'basic', 'pro'];
  if (tier && !validTiers.includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier. Must be free, basic, or pro' });
  }

  try {
    const result = await createSharedUser(email, tier || 'free', quotaGB);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/shared/users/:id/quota', adminAuth, async (req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }

  const { quotaGB } = req.body;
  if (typeof quotaGB !== 'number' || quotaGB < 1) {
    return res.status(400).json({ error: 'quotaGB must be a positive number' });
  }

  try {
    const result = await updateSharedUserQuota(req.params.id, quotaGB);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/shared/users/:id/tier', adminAuth, async (req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }

  const { tier, quotaGB } = req.body;
  const validTiers: UserTier[] = ['free', 'basic', 'pro'];
  
  if (!validTiers.includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier. Must be free, basic, or pro' });
  }

  try {
    const result = await updateSharedUserTier(req.params.id, tier, quotaGB);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/shared/users/:id/migrate', adminAuth, async (req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }

  const { tier, quotaGB } = req.body;
  const validTiers: UserTier[] = ['free', 'basic', 'pro'];
  
  if (!validTiers.includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier. Must be free, basic, or pro' });
  }

  try {
    const result = await migrateUserBetweenInstances(req.params.id, tier, quotaGB);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/shared/users/:id', adminAuth, async (req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }

  const force = req.query.force === 'true';

  try {
    const result = await deleteSharedUser(req.params.id, force);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/shared/users/:id/stats', adminAuth, async (req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }

  try {
    const result = await getSharedUserStats(req.params.id);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result.stats);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Shared instances health and stats
app.get('/api/shared/instances', adminAuth, async (_req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }

  try {
    const [freeHealth, paidHealth, freeStats, paidStats] = await Promise.all([
      checkSharedInstanceHealth('free'),
      checkSharedInstanceHealth('paid'),
      getSharedInstanceStats('free'),
      getSharedInstanceStats('paid'),
    ]);

    res.json({
      deploymentMode: DEPLOYMENT_MODE,
      instances: {
        free: {
          url: SHARED_INSTANCES.free.url,
          healthy: freeHealth.healthy,
          healthMessage: freeHealth.message,
          hasML: SHARED_INSTANCES.free.hasML,
          stats: freeStats.success ? freeStats.stats : null,
        },
        paid: {
          url: SHARED_INSTANCES.paid.url,
          healthy: paidHealth.healthy,
          healthMessage: paidHealth.message,
          hasML: SHARED_INSTANCES.paid.hasML,
          stats: paidStats.success ? paidStats.stats : null,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin: List pending deletions
app.get('/api/shared/deletions', adminAuth, (_req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }
  res.json(listPendingDeletions());
});

// Admin: Process scheduled deletions
app.post('/api/shared/deletions/process', adminAuth, async (_req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }

  try {
    const result = await processScheduledDeletions();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Admin: Immediately delete user (bypass 2-week delay)
app.delete('/api/shared/users/:id/force', adminAuth, async (req: Request, res: Response) => {
  if (DEPLOYMENT_MODE !== 'shared') {
    return res.status(400).json({ error: 'Only available in shared deployment mode' });
  }

  try {
    const result = await deleteSharedUser(req.params.id, true);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: 'User deleted immediately' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Instance Upgrade API (Admin)
// =============================================================================

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Upgrade a shared instance
app.post('/api/shared/instances/:instance/upgrade', adminAuth, async (req: Request, res: Response) => {
  const instance = req.params.instance as 'free' | 'paid';
  
  if (!['free', 'paid'].includes(instance)) {
    return res.status(400).json({ error: 'Invalid instance. Use "free" or "paid"' });
  }

  const instanceDir = `/data/instances/${instance}`;
  
  try {
    console.log(`Starting upgrade for ${instance} instance...`);
    
    // Pull latest images and restart
    const { stdout, stderr } = await execAsync(
      `cd ${instanceDir} && docker compose pull && docker compose up -d`,
      { timeout: 300000 } // 5 minute timeout
    );
    
    console.log(`Upgrade output: ${stdout}`);
    if (stderr) console.log(`Upgrade stderr: ${stderr}`);
    
    // Clean up old images
    await execAsync('docker image prune -f');
    
    res.json({ 
      success: true, 
      message: `${instance} instance upgraded successfully`,
      output: stdout,
    });
  } catch (err) {
    console.error(`Upgrade error for ${instance}:`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// Upgrade all shared instances
app.post('/api/shared/instances/upgrade-all', adminAuth, async (_req: Request, res: Response) => {
  try {
    const results: Record<string, { success: boolean; message?: string; error?: string }> = {};
    
    for (const instance of ['free', 'paid'] as const) {
      const instanceDir = `/data/instances/${instance}`;
      
      try {
        console.log(`Upgrading ${instance} instance...`);
        await execAsync(
          `cd ${instanceDir} && docker compose pull && docker compose up -d`,
          { timeout: 300000 }
        );
        results[instance] = { success: true, message: 'Upgraded successfully' };
      } catch (err) {
        results[instance] = { success: false, error: (err as Error).message };
      }
    }
    
    // Clean up old images
    await execAsync('docker image prune -f');
    
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get current Immich version
app.get('/api/shared/instances/:instance/version', adminAuth, async (req: Request, res: Response) => {
  const instance = req.params.instance as 'free' | 'paid';
  
  if (!['free', 'paid'].includes(instance)) {
    return res.status(400).json({ error: 'Invalid instance. Use "free" or "paid"' });
  }

  const config = instance === 'free' ? SHARED_INSTANCES.free : SHARED_INSTANCES.paid;
  
  try {
    const response = await fetch(`${config.internalUrl}/api/server/about`, {
      headers: { 'x-api-key': config.apiKey },
    });
    
    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to get version info' });
    }
    
    const data = await response.json() as { version?: string; build?: string };
    res.json({
      instance,
      version: data.version,
      build: data.build,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Branding API
// =============================================================================
app.get('/api/instances/:id/branding', adminAuth, (req: Request, res: Response) => {
  try {
    const branding = getBranding(req.params.id);
    if (!branding) {
      return res.json({});
    }
    res.json(branding);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/instances/:id/branding', adminAuth, (req: Request, res: Response) => {
  try {
    const branding = updateBranding(req.params.id, req.body as BrandingSettings);
    res.json(branding);
  } catch (err) {
    if ((err as Error).message === 'Instance not found') {
      return res.status(404).json({ error: 'Instance not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/instances/:id/branding', adminAuth, (req: Request, res: Response) => {
  try {
    deleteBranding(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message === 'Instance not found') {
      return res.status(404).json({ error: 'Instance not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

// Custom CSS endpoint for Immich injection
app.get('/api/instances/:id/custom.css', (req: Request, res: Response) => {
  try {
    const branding = getBranding(req.params.id);
    if (!branding) {
      res.type('text/css').send('/* No custom branding */');
      return;
    }
    const css = generateCustomCss(branding);
    res.type('text/css').send(css);
  } catch {
    res.type('text/css').send('/* Error loading branding */');
  }
});

// =============================================================================
// Export API (DSGVO Data Export)
// =============================================================================
app.post('/api/instances/:id/export', adminAuth, async (req: Request, res: Response) => {
  try {
    const job = await startExport(req.params.id);
    res.json(job);
  } catch (err) {
    if ((err as Error).message === 'Instance not found') {
      return res.status(404).json({ error: 'Instance not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/instances/:id/export/:jobId', adminAuth, (req: Request, res: Response) => {
  const job = getExportJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Export job not found' });
  }
  if (job.instanceId !== req.params.id) {
    return res.status(404).json({ error: 'Export job not found' });
  }
  res.json(job);
});

app.get('/api/instances/:id/exports', adminAuth, (req: Request, res: Response) => {
  const jobs = listExportJobs(req.params.id);
  res.json(jobs);
});

// Public download endpoint (token-based auth)
app.get('/api/exports/:token', (req: Request, res: Response) => {
  const result = getExportByToken(req.params.token);
  if (!result) {
    return res.status(404).json({ error: 'Export not found or expired' });
  }
  
  const { job, filePath } = result;
  res.download(filePath, `sphoto-export-${job.instanceId}.zip`);
});

// Notify user when export is ready (called after job completion)
app.post('/api/instances/:id/export/:jobId/notify', adminAuth, async (req: Request, res: Response) => {
  try {
    const job = getExportJob(req.params.jobId);
    if (!job || job.instanceId !== req.params.id) {
      return res.status(404).json({ error: 'Export job not found' });
    }
    
    if (job.status !== 'completed' || !job.downloadToken) {
      return res.status(400).json({ error: 'Export not ready' });
    }
    
    const instance = getInstance(req.params.id);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    const downloadUrl = `https://api.${env.DOMAIN}/api/exports/${job.downloadToken}`;
    await sendExportReadyEmail(instance.email, instance.id, downloadUrl, job.fileSize || 0);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Analytics API
// =============================================================================
app.get('/api/analytics', adminAuth, (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const analytics = getAnalytics(Math.min(days, 90)); // Max 90 days
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Manual trigger for stats collection (useful for testing)
app.post('/api/analytics/collect', adminAuth, async (_req: Request, res: Response) => {
  try {
    await runDailyStatsCollection();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Alerts API
// =============================================================================
app.get('/api/instances/:id/alerts', adminAuth, (req: Request, res: Response) => {
  try {
    const history = getAlertHistory(req.params.id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/instances/:id/alerts/settings', adminAuth, (req: Request, res: Response) => {
  try {
    const history = updateAlertSettings(req.params.id, req.body);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/admin/alerts/test/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const alertType = req.body.type as AlertType;
    const adminEmail = req.body.adminEmail || env.EMAIL_FROM.replace(/.*<(.*)>/, '$1');
    await sendTestAlert(req.params.id, alertType, adminEmail);
    res.json({ success: true });
  } catch (err) {
    if ((err as Error).message === 'Instance not found') {
      return res.status(404).json({ error: 'Instance not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/admin/alerts/summary', adminAuth, (_req: Request, res: Response) => {
  try {
    const alerts = getActiveAlerts();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/admin/alerts/check', adminAuth, async (req: Request, res: Response) => {
  try {
    const adminEmail = req.body.adminEmail || env.EMAIL_FROM.replace(/.*<(.*)>/, '$1');
    const alerts = await runAlertCheck(adminEmail);
    res.json({ triggered: alerts.length, alerts });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Plan Migration API
// =============================================================================
app.get('/api/instances/:id/plan', adminAuth, async (req: Request, res: Response) => {
  try {
    const info = await getPlanInfo(req.params.id);
    if (!info) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/instances/:id/plan/upgrade', adminAuth, async (req: Request, res: Response) => {
  try {
    const { stripeCustomerId, stripeSubscriptionId } = req.body;
    const result = await upgradePlan(req.params.id, stripeCustomerId, stripeSubscriptionId);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/instances/:id/plan/downgrade', adminAuth, async (req: Request, res: Response) => {
  try {
    const { stripeSubscriptionId } = req.body;
    const result = await downgradePlan(req.params.id, stripeSubscriptionId);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/instances/:id/plan/check', adminAuth, async (req: Request, res: Response) => {
  try {
    const result = await checkDowngradePossible(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Maintenance API
// =============================================================================
app.get('/api/admin/maintenance', adminAuth, (_req: Request, res: Response) => {
  try {
    const maintenances = listMaintenances();
    res.json(maintenances);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/admin/maintenance', adminAuth, async (req: Request, res: Response) => {
  try {
    const input: MaintenanceCreateInput = req.body;
    const maintenance = await createMaintenance(input);
    res.status(201).json(maintenance);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/admin/maintenance/:id', adminAuth, (req: Request, res: Response) => {
  try {
    const maintenance = getMaintenance(req.params.id);
    if (!maintenance) {
      return res.status(404).json({ error: 'Maintenance not found' });
    }
    res.json(maintenance);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/admin/maintenance/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const maintenance = await updateMaintenance(req.params.id, req.body);
    if (!maintenance) {
      return res.status(404).json({ error: 'Maintenance not found' });
    }
    res.json(maintenance);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.delete('/api/admin/maintenance/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    const maintenance = await cancelMaintenance(req.params.id);
    if (!maintenance) {
      return res.status(404).json({ error: 'Maintenance not found' });
    }
    res.json(maintenance);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/admin/maintenance/:id/start', adminAuth, async (req: Request, res: Response) => {
  try {
    const maintenance = await startMaintenance(req.params.id);
    if (!maintenance) {
      return res.status(404).json({ error: 'Maintenance not found' });
    }
    res.json(maintenance);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/admin/maintenance/:id/complete', adminAuth, async (req: Request, res: Response) => {
  try {
    const maintenance = await completeMaintenance(req.params.id);
    if (!maintenance) {
      return res.status(404).json({ error: 'Maintenance not found' });
    }
    res.json(maintenance);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Public status endpoint (no auth required)
app.get('/api/status', (_req: Request, res: Response) => {
  try {
    const status = getPublicStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Health Monitoring API
// =============================================================================
app.get('/api/admin/health', adminAuth, (_req: Request, res: Response) => {
  try {
    const summary = getHealthSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/admin/health/:id', adminAuth, (req: Request, res: Response) => {
  try {
    const health = getInstanceHealth(req.params.id);
    if (!health) {
      return res.status(404).json({ error: 'Health status not found' });
    }
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/admin/health/check', adminAuth, async (_req: Request, res: Response) => {
  try {
    const summary = await runHealthCheck();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// =============================================================================
// Start Server
// =============================================================================
const PORT = process.env.PORT || 3000;

// Cleanup expired exports on startup
cleanupExpiredExports().catch(console.error);

// Run daily stats collection on startup
runDailyStatsCollection().catch(console.error);

// Check maintenance notifications on startup
checkMaintenanceNotifications().catch(console.error);

// Schedule stats collection (runs every 4 hours)
const scheduleStatsCollection = () => {
  // Run immediately
  runDailyStatsCollection().catch(console.error);
  
  // Then every 4 hours
  setInterval(() => {
    runDailyStatsCollection().catch(console.error);
  }, 4 * 60 * 60 * 1000);
};
scheduleStatsCollection();

// Schedule alert checks (every 6 hours)
const scheduleAlertChecks = () => {
  // Run immediately, then every 6 hours
  runAlertCheck(env.ADMIN_EMAIL).catch(console.error);
  
  setInterval(() => {
    runAlertCheck(env.ADMIN_EMAIL).catch(console.error);
  }, 6 * 60 * 60 * 1000);
};
scheduleAlertChecks();

// Schedule maintenance notification checks (every hour)
setInterval(() => {
  checkMaintenanceNotifications().catch(console.error);
}, 60 * 60 * 1000);

// Schedule health checks (every 15 minutes)
const scheduleHealthChecks = () => {
  // Run after 30 seconds (let instances start up)
  setTimeout(() => {
    runHealthCheck().catch(console.error);
  }, 30000);
  
  // Then every 15 minutes
  setInterval(() => {
    runHealthCheck().catch(console.error);
  }, 15 * 60 * 1000);
};
scheduleHealthChecks();

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║     SPhoto Automation Server         ║
║     TypeScript/Bun Edition           ║
║     Domain: ${env.DOMAIN.padEnd(20)}║
║     Port: ${String(PORT).padEnd(24)}║
╚══════════════════════════════════════╝
`);
});

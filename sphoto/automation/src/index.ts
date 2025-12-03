// =============================================================================
// SPhoto Automation Server - TypeScript/Bun
// =============================================================================

import express, { type Request, type Response, type NextFunction } from 'express';
import { env } from './config';
import { handleWebhook, getSessionStatus, createCheckoutSession } from './stripe';
import { checkSubdomain, isValidSubdomain } from './subdomain';
import { listInstances, getInstance, startInstance, stopInstance, deleteInstance } from './instances';
import { RESERVED_SUBDOMAINS } from './config';
import { getBranding, updateBranding, deleteBranding, generateCustomCss } from './branding';
import { startExport, getExportJob, getExportByToken, listExportJobs, cleanupExpiredExports } from './export';
import { getAnalytics, runDailyStatsCollection } from './analytics';
import { sendExportReadyEmail } from './email';
import type { BrandingSettings } from './types';

const app = express();

// =============================================================================
// CORS Middleware
// =============================================================================
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
  
  // Validate subdomain if provided
  if (subdomain) {
    if (!isValidSubdomain(subdomain)) {
      return res.status(400).send('Ungültige Subdomain');
    }
    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      return res.status(400).send('Subdomain reserviert');
    }
    const instances = listInstances();
    if (instances.some(i => i.id === subdomain)) {
      return res.status(400).send('Subdomain bereits vergeben');
    }
  }
  
  try {
    const url = await createCheckoutSession(plan, subdomain);
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
    const { join } = await import('path');
    const { EXTERNAL_STORAGE_PATH, INSTANCES_DIR } = await import('./config');
    const { getDirectorySize } = await import('./instances');
    
    // Determine upload path
    let uploadsPath: string;
    if (EXTERNAL_STORAGE_PATH) {
      uploadsPath = join(EXTERNAL_STORAGE_PATH, instanceId, 'uploads');
    } else {
      uploadsPath = join(INSTANCES_DIR, instanceId, 'uploads');
    }
    
    if (!existsSync(uploadsPath)) {
      return res.json({ 
        usage: 0, 
        photos: 0, 
        videos: 0,
        usageByUser: [] 
      });
    }
    
    const usage = await getDirectorySize(uploadsPath);
    
    res.json({ 
      usage, 
      photos: 0, // Can't determine without API
      videos: 0, // Can't determine without API
      usageByUser: [] 
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
// Start Server
// =============================================================================
const PORT = process.env.PORT || 3000;

// Cleanup expired exports on startup
cleanupExpiredExports().catch(console.error);

// Run daily stats collection on startup
runDailyStatsCollection().catch(console.error);

// Schedule daily stats collection (runs at midnight)
const scheduleDaily = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();
  
  setTimeout(() => {
    runDailyStatsCollection().catch(console.error);
    // Schedule next run in 24 hours
    setInterval(() => {
      runDailyStatsCollection().catch(console.error);
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
};
scheduleDaily();

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

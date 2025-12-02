// =============================================================================
// SPhoto Automation Server - TypeScript/Bun
// =============================================================================

import express, { type Request, type Response, type NextFunction } from 'express';
import { env } from './config';
import { handleWebhook, getSessionStatus, createCheckoutSession } from './stripe';
import { checkSubdomain, isValidSubdomain } from './subdomain';
import { listInstances, getInstance, startInstance, stopInstance, deleteInstance } from './instances';
import { RESERVED_SUBDOMAINS } from './config';

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
// Start Server
// =============================================================================
const PORT = process.env.PORT || 3000;

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

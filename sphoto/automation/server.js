import express from 'express';
import Stripe from 'stripe';
import { Resend } from 'resend';
import Docker from 'dockerode';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const DOMAIN = process.env.DOMAIN || 'sphoto.arturf.ch';
const INSTANCES_DIR = '/data/instances';
const PLANS = {
  [process.env.STRIPE_PRICE_BASIC]: { name: 'Basic', storage: 200 },
  [process.env.STRIPE_PRICE_PRO]: { name: 'Pro', storage: 1000 },
};

// Store checkout session status (in-memory, resets on restart)
const sessionStatus = new Map();

// Stripe webhook needs raw body
app.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);
app.use(express.json());

// =============================================================================
// Webhook Handler
// =============================================================================
async function handleWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const sessionId = session.id;
        
        // Mark as processing
        sessionStatus.set(sessionId, { status: 'processing', message: 'Erstelle deine Cloud...' });
        
        if (session.mode === 'subscription' && session.customer_email) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          const priceId = sub.items.data[0].price.id;
          const plan = PLANS[priceId];
          
          if (plan) {
            const id = generateId(session.customer_email);
            
            sessionStatus.set(sessionId, { status: 'processing', message: 'Container werden gestartet...' });
            await createInstance(id, session.customer_email, plan);
            
            await stripe.customers.update(session.customer, {
              metadata: { sphoto_id: id }
            });
            
            sessionStatus.set(sessionId, { status: 'processing', message: 'Sende Willkommens-E-Mail...' });
            await sendWelcomeEmail(session.customer_email, id, plan.name);
            
            // Mark as complete with instance URL
            sessionStatus.set(sessionId, { 
              status: 'complete', 
              instanceId: id,
              instanceUrl: `https://${id}.${DOMAIN}`,
              email: session.customer_email,
              plan: plan.name
            });
            
            console.log(`Instance ${id} created for ${session.customer_email}`);
          } else {
            sessionStatus.set(sessionId, { status: 'error', message: 'Plan nicht erkannt. Bitte kontaktiere den Support.' });
            console.error(`Unknown price ID: ${priceId}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customer = await stripe.customers.retrieve(invoice.customer);
        if (customer.metadata?.sphoto_id) {
          await stopInstance(customer.metadata.sphoto_id);
          await sendPaymentFailedEmail(customer.email, customer.metadata.sphoto_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        if (customer.metadata?.sphoto_id) {
          await stopInstance(customer.metadata.sphoto_id);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: err.message });
  }
}

// =============================================================================
// Instance Management
// =============================================================================
function generateId(email) {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

async function createInstance(id, email, plan) {
  console.log(`Creating instance: ${id} for ${email}`);
  
  const dir = join(INSTANCES_DIR, id);
  mkdirSync(join(dir, 'uploads'), { recursive: true });
  mkdirSync(join(dir, 'db'), { recursive: true });

  const dbPass = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

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
      - ./uploads:/data
    depends_on:
      - db
      - redis
    restart: unless-stopped
    networks:
      - sphoto-net
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${id}.rule=Host(\`${id}.${DOMAIN}\`)"
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
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify({
    id, email, plan: plan.name, storage_gb: plan.storage,
    created: new Date().toISOString(), status: 'active'
  }, null, 2));

  // Start with docker compose
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  await execAsync(`cd ${dir} && docker compose up -d`);
  console.log(`Instance ${id} created`);
}

async function stopInstance(id) {
  const dir = join(INSTANCES_DIR, id);
  if (!existsSync(dir)) return;

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  await execAsync(`cd ${dir} && docker compose down`);
  
  const metaPath = join(dir, 'metadata.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  meta.status = 'stopped';
  meta.stopped_at = new Date().toISOString();
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  
  console.log(`Instance ${id} stopped`);
}

async function startInstance(id) {
  const dir = join(INSTANCES_DIR, id);
  if (!existsSync(dir)) throw new Error('Instance not found');

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  await execAsync(`cd ${dir} && docker compose up -d`);
  
  const metaPath = join(dir, 'metadata.json');
  const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
  meta.status = 'active';
  delete meta.stopped_at;
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  
  console.log(`Instance ${id} started`);
}

async function deleteInstance(id) {
  const dir = join(INSTANCES_DIR, id);
  if (!existsSync(dir)) throw new Error('Instance not found');

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const { rm } = await import('fs/promises');

  await execAsync(`cd ${dir} && docker compose down -v`);
  await rm(dir, { recursive: true, force: true });
  
  console.log(`Instance ${id} deleted`);
}

function listInstances() {
  if (!existsSync(INSTANCES_DIR)) return [];
  
  return readdirSync(INSTANCES_DIR)
    .filter(d => existsSync(join(INSTANCES_DIR, d, 'metadata.json')))
    .map(d => JSON.parse(readFileSync(join(INSTANCES_DIR, d, 'metadata.json'), 'utf-8')));
}

// =============================================================================
// E-Mail
// =============================================================================
async function sendWelcomeEmail(email, id, planName) {
  const url = `https://${id}.${DOMAIN}`;
  
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'SPhoto <noreply@arturf.ch>',
    to: email,
    subject: '🎉 Deine SPhoto Cloud ist bereit!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #111;">
          <span style="color: #dc2626;">S</span>Photo
        </h1>
        
        <p>Hallo!</p>
        <p>Deine persönliche Photo-Cloud ist bereit.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Plan:</strong> ${planName}</p>
          <p style="margin: 0;"><strong>Deine URL:</strong></p>
          <p style="margin: 5px 0 0 0; font-size: 18px;">
            <a href="${url}" style="color: #dc2626;">${url}</a>
          </p>
        </div>
        
        <h3>Nächste Schritte:</h3>
        <ol>
          <li>Öffne <a href="${url}">${url}</a></li>
          <li>Erstelle deinen Account</li>
          <li>Lade die <strong>Immich App</strong> (iOS/Android)</li>
          <li>Verbinde mit: <code>${url}</code></li>
        </ol>
        
        <p style="background: #fef3c7; padding: 10px; border-radius: 4px; font-size: 14px;">
          ⚠️ <strong>Wichtig:</strong> SPhoto ist ein Budget-Service ohne Backup. 
          Erstelle eigene Backups!
        </p>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Bei Fragen: support@arturf.ch
        </p>
      </div>
    `
  });
  
  console.log(`Welcome email sent to ${email}`);
}

async function sendPaymentFailedEmail(email, id) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'SPhoto <noreply@arturf.ch>',
    to: email,
    subject: '⚠️ SPhoto: Zahlung fehlgeschlagen',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h1><span style="color: #dc2626;">S</span>Photo</h1>
        <p>Deine letzte Zahlung ist fehlgeschlagen.</p>
        <p><strong>Dein Account wurde pausiert.</strong></p>
        <p>Deine Daten bleiben 30 Tage gespeichert. Aktualisiere deine Zahlungsmethode um fortzufahren.</p>
      </div>
    `
  });
}

// =============================================================================
// Admin API
// =============================================================================
const auth = (req, res, next) => {
  if (req.headers['x-api-key'] !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// =============================================================================
// Checkout Session (proper Stripe integration)
// =============================================================================
app.get('/checkout/:plan', async (req, res) => {
  const plan = req.params.plan;
  const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_BASIC;
  
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `https://${DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${DOMAIN}`,
      customer_email: req.query.email || undefined,
    });
    
    res.redirect(303, session.url);
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).send('Checkout failed');
  }
});

// Status endpoint for success page polling
app.get('/status/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const status = sessionStatus.get(sessionId);
  
  if (status) {
    res.json(status);
  } else {
    // Check if session exists in Stripe
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'paid') {
        res.json({ status: 'processing', message: 'Zahlung erhalten, erstelle Cloud...' });
      } else {
        res.json({ status: 'pending', message: 'Warte auf Zahlung...' });
      }
    } catch {
      res.json({ status: 'unknown', message: 'Session nicht gefunden' });
    }
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok', domain: DOMAIN }));

app.get('/api/instances', auth, (_, res) => {
  res.json(listInstances());
});

app.post('/api/instances', auth, async (req, res) => {
  try {
    const { email, plan } = req.body;
    const planConfig = plan === 'pro' 
      ? { name: 'Pro', storage: 1000 }
      : { name: 'Basic', storage: 200 };
    
    const id = generateId(email);
    await createInstance(id, email, planConfig);
    await sendWelcomeEmail(email, id, planConfig.name);
    
    res.json({ id, url: `https://${id}.${DOMAIN}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/instances/:id/start', auth, async (req, res) => {
  try {
    await startInstance(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/instances/:id/stop', auth, async (req, res) => {
  try {
    await stopInstance(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/instances/:id', auth, async (req, res) => {
  try {
    await deleteInstance(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// Start
// =============================================================================
app.listen(3000, () => {
  console.log(`
╔══════════════════════════════════════╗
║     SPhoto Automation Server         ║
║     Domain: ${DOMAIN.padEnd(22)}║
║     Port: 3000                       ║
╚══════════════════════════════════════╝
  `);
});

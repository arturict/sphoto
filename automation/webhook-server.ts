/**
 * SwissPhoto Automation Server
 * 
 * Automatische Provisionierung von Kunden-Instanzen via Stripe Webhooks
 * Domain: arturferreira.tech
 */

import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';

const execAsync = promisify(exec);

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  domain: 'arturferreira.tech',
  instancesDir: '/opt/swissphoto/instances',
  port: 3500,
  
  // Stripe Price IDs (ersetze mit deinen echten IDs)
  plans: {
    'price_basic_100gb': { storage: 100, name: 'Basic' },
    'price_standard_200gb': { storage: 200, name: 'Standard' },
    'price_pro_500gb': { storage: 500, name: 'Pro' },
    'price_power_1tb': { storage: 1000, name: 'Power' },
  } as Record<string, { storage: number; name: string }>,
  
  // E-Mail Einstellungen
  email: {
    from: 'SwissPhoto <noreply@arturferreira.tech>',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
  },
};

// =============================================================================
// Initialize
// =============================================================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const app = express();

// Stripe benötigt raw body für Webhook-Verifizierung
app.post('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

const transporter = nodemailer.createTransport(CONFIG.email.smtp);

// =============================================================================
// Helper Functions
// =============================================================================

function generateCustomerId(email: string): string {
  // Generiere eine saubere Customer ID aus der E-Mail
  const base = email.split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 15);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

async function createInstance(customerId: string, email: string, storageGb: number): Promise<void> {
  console.log(`Creating instance: ${customerId} (${storageGb}GB) for ${email}`);
  
  const instanceDir = path.join(CONFIG.instancesDir, customerId);
  
  // Verzeichnisse erstellen
  await fs.mkdir(path.join(instanceDir, 'uploads'), { recursive: true });
  await fs.mkdir(path.join(instanceDir, 'postgres'), { recursive: true });
  
  // Zufälliges DB-Passwort
  const dbPassword = [...Array(24)].map(() => Math.random().toString(36)[2]).join('');
  
  // Docker Compose generieren
  const composeContent = `
name: swissphoto-${customerId}

services:
  server:
    container_name: sp_${customerId}_server
    image: ghcr.io/immich-app/immich-server:\${IMMICH_VERSION:-release}
    volumes:
      - ./uploads:/data
      - /etc/localtime:/etc/localtime:ro
    environment:
      - DB_URL=postgresql://swissphoto:${dbPassword}@database:5432/swissphoto
      - REDIS_HOSTNAME=redis
      - MACHINE_LEARNING_URL=http://swissphoto-ml:3003
    depends_on:
      - redis
      - database
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${customerId}.rule=Host(\`${customerId}.${CONFIG.domain}\`)"
      - "traefik.http.routers.${customerId}.entrypoints=websecure"
      - "traefik.http.routers.${customerId}.tls.certresolver=letsencrypt"
      - "traefik.http.services.${customerId}.loadbalancer.server.port=2283"
    networks:
      - swissphoto-shared
      - internal

  redis:
    container_name: sp_${customerId}_redis
    image: docker.io/valkey/valkey:9
    restart: unless-stopped
    networks:
      - internal

  database:
    container_name: sp_${customerId}_db
    image: ghcr.io/immich-app/postgres:14-vectorchord0.4.3-pgvectors0.2.0
    environment:
      - POSTGRES_PASSWORD=${dbPassword}
      - POSTGRES_USER=swissphoto
      - POSTGRES_DB=swissphoto
    volumes:
      - ./postgres:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - internal

networks:
  swissphoto-shared:
    external: true
  internal:
    driver: bridge
`;

  await fs.writeFile(path.join(instanceDir, 'docker-compose.yml'), composeContent);
  
  // Metadata speichern
  const metadata = {
    customer_id: customerId,
    email,
    storage_gb: storageGb,
    created_at: new Date().toISOString(),
    status: 'active',
  };
  await fs.writeFile(
    path.join(instanceDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  // Docker Compose starten
  await execAsync(`cd ${instanceDir} && docker compose up -d`);
  
  console.log(`Instance ${customerId} created successfully!`);
}

async function stopInstance(customerId: string): Promise<void> {
  const instanceDir = path.join(CONFIG.instancesDir, customerId);
  await execAsync(`cd ${instanceDir} && docker compose down`);
  
  // Status updaten
  const metadataPath = path.join(instanceDir, 'metadata.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  metadata.status = 'stopped';
  metadata.stopped_at = new Date().toISOString();
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  
  console.log(`Instance ${customerId} stopped`);
}

async function startInstance(customerId: string): Promise<void> {
  const instanceDir = path.join(CONFIG.instancesDir, customerId);
  await execAsync(`cd ${instanceDir} && docker compose up -d`);
  
  // Status updaten
  const metadataPath = path.join(instanceDir, 'metadata.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  metadata.status = 'active';
  delete metadata.stopped_at;
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  
  console.log(`Instance ${customerId} started`);
}

async function deleteInstance(customerId: string): Promise<void> {
  const instanceDir = path.join(CONFIG.instancesDir, customerId);
  await execAsync(`cd ${instanceDir} && docker compose down -v`);
  await fs.rm(instanceDir, { recursive: true, force: true });
  console.log(`Instance ${customerId} deleted permanently`);
}

async function sendWelcomeEmail(email: string, customerId: string, plan: string): Promise<void> {
  const instanceUrl = `https://${customerId}.${CONFIG.domain}`;
  
  await transporter.sendMail({
    from: CONFIG.email.from,
    to: email,
    subject: '🎉 Willkommen bei SwissPhoto!',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #e11d48;">Willkommen bei SwissPhoto! 🇨🇭</h1>
        
        <p>Hallo,</p>
        
        <p>Deine persönliche Photo-Cloud ist bereit!</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Dein Plan:</strong> ${plan}</p>
          <p><strong>Deine URL:</strong></p>
          <p style="font-size: 18px;">
            <a href="${instanceUrl}" style="color: #e11d48;">${instanceUrl}</a>
          </p>
        </div>
        
        <h3>Nächste Schritte:</h3>
        <ol>
          <li>Öffne <a href="${instanceUrl}">${instanceUrl}</a></li>
          <li>Erstelle deinen Admin-Account</li>
          <li>Lade die Immich App herunter (iOS/Android)</li>
          <li>Verbinde die App mit deiner URL</li>
        </ol>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>⚠️ Wichtig:</strong> SwissPhoto ist ein Budget-Service ohne Backup. 
          Bitte erstelle regelmässig eigene Backups deiner wichtigen Fotos!</p>
        </div>
        
        <p>Bei Fragen: support@arturferreira.tech</p>
        
        <p>Viel Spass mit SwissPhoto!</p>
      </div>
    `,
  });
  
  console.log(`Welcome email sent to ${email}`);
}

async function sendStoppedEmail(email: string, customerId: string): Promise<void> {
  await transporter.sendMail({
    from: CONFIG.email.from,
    to: email,
    subject: '⚠️ SwissPhoto: Dein Account wurde pausiert',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f59e0b;">Account pausiert</h1>
        
        <p>Hallo,</p>
        
        <p>Dein SwissPhoto-Account wurde pausiert, da die letzte Zahlung nicht erfolgreich war.</p>
        
        <p><strong>Deine Daten sind noch 30 Tage gespeichert.</strong></p>
        
        <p>Um deinen Account wieder zu aktivieren, aktualisiere bitte deine Zahlungsmethode.</p>
        
        <p>Bei Fragen: support@arturferreira.tech</p>
      </div>
    `,
  });
}

// =============================================================================
// Stripe Webhook Handler
// =============================================================================

app.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }
  
  console.log(`Received event: ${event.type}`);
  
  try {
    switch (event.type) {
      // =====================================================================
      // Neue Subscription erstellt
      // =====================================================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'subscription' && session.customer_email) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const priceId = subscription.items.data[0].price.id;
          const plan = CONFIG.plans[priceId];
          
          if (plan) {
            const customerId = generateCustomerId(session.customer_email);
            
            // Instanz erstellen
            await createInstance(customerId, session.customer_email, plan.storage);
            
            // Welcome E-Mail senden
            await sendWelcomeEmail(session.customer_email, customerId, plan.name);
            
            // Customer ID in Stripe Metadata speichern
            await stripe.customers.update(session.customer as string, {
              metadata: { swissphoto_instance: customerId },
            });
          }
        }
        break;
      }
      
      // =====================================================================
      // Zahlung erfolgreich
      // =====================================================================
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        
        if (invoice.billing_reason === 'subscription_cycle') {
          const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer;
          const customerId = customer.metadata?.swissphoto_instance;
          
          if (customerId) {
            // Falls Instanz gestoppt war, wieder starten
            const metadataPath = path.join(CONFIG.instancesDir, customerId, 'metadata.json');
            try {
              const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
              if (metadata.status === 'stopped') {
                await startInstance(customerId);
              }
            } catch {
              // Instanz existiert nicht mehr
            }
          }
        }
        break;
      }
      
      // =====================================================================
      // Zahlung fehlgeschlagen
      // =====================================================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer;
        const customerId = customer.metadata?.swissphoto_instance;
        
        if (customerId && customer.email) {
          await stopInstance(customerId);
          await sendStoppedEmail(customer.email, customerId);
        }
        break;
      }
      
      // =====================================================================
      // Subscription gekündigt
      // =====================================================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
        const customerId = customer.metadata?.swissphoto_instance;
        
        if (customerId) {
          // Instanz stoppen (nicht löschen - gibt dem Kunden Zeit)
          await stopInstance(customerId);
          
          // Nach 30 Tagen automatisch löschen (via Cron Job)
          const metadataPath = path.join(CONFIG.instancesDir, customerId, 'metadata.json');
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
          metadata.delete_after = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        }
        break;
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// =============================================================================
// Admin API Endpoints
// =============================================================================

// Einfache API-Key Auth
const adminAuth = (req: Request, res: Response, next: Function) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Liste alle Instanzen
app.get('/api/instances', adminAuth, async (_req: Request, res: Response) => {
  try {
    const dirs = await fs.readdir(CONFIG.instancesDir);
    const instances = await Promise.all(
      dirs.map(async (dir) => {
        try {
          const metadata = JSON.parse(
            await fs.readFile(path.join(CONFIG.instancesDir, dir, 'metadata.json'), 'utf-8')
          );
          return metadata;
        } catch {
          return null;
        }
      })
    );
    res.json(instances.filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: 'Failed to list instances' });
  }
});

// Manuelle Instanz-Erstellung
app.post('/api/instances', adminAuth, async (req: Request, res: Response) => {
  const { email, storage_gb } = req.body;
  
  if (!email || !storage_gb) {
    return res.status(400).json({ error: 'Missing email or storage_gb' });
  }
  
  try {
    const customerId = generateCustomerId(email);
    await createInstance(customerId, email, storage_gb);
    res.json({ 
      success: true, 
      customer_id: customerId,
      url: `https://${customerId}.${CONFIG.domain}`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create instance' });
  }
});

// Instanz stoppen
app.post('/api/instances/:id/stop', adminAuth, async (req: Request, res: Response) => {
  try {
    await stopInstance(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop instance' });
  }
});

// Instanz starten
app.post('/api/instances/:id/start', adminAuth, async (req: Request, res: Response) => {
  try {
    await startInstance(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start instance' });
  }
});

// Instanz löschen
app.delete('/api/instances/:id', adminAuth, async (req: Request, res: Response) => {
  try {
    await deleteInstance(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete instance' });
  }
});

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', domain: CONFIG.domain });
});

// =============================================================================
// Start Server
// =============================================================================

app.listen(CONFIG.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           SwissPhoto Automation Server                    ║
╠═══════════════════════════════════════════════════════════╣
║  Domain:   ${CONFIG.domain.padEnd(43)}║
║  Port:     ${CONFIG.port.toString().padEnd(43)}║
║  Webhook:  http://localhost:${CONFIG.port}/webhook${' '.repeat(20)}║
╚═══════════════════════════════════════════════════════════╝
  `);
});

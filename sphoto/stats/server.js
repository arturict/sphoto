import express from 'express';
import Stripe from 'stripe';
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const INSTANCES_DIR = '/data/instances';

// =============================================================================
// Basic Auth Middleware
// =============================================================================
const basicAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="SPhoto Admin"');
    return res.status(401).send('Authentication required');
  }
  
  const credentials = Buffer.from(auth.slice(6), 'base64').toString();
  const [user, pass] = credentials.split(':');
  
  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
    return next();
  }
  
  res.setHeader('WWW-Authenticate', 'Basic realm="SPhoto Admin"');
  return res.status(401).send('Invalid credentials');
};

// Apply auth to all routes except health
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(basicAuth);

// =============================================================================
// Stats API
// =============================================================================
async function getStats() {
  const instances = [];
  let totalStorage = 0;
  let activeCount = 0;

  if (existsSync(INSTANCES_DIR)) {
    for (const dir of readdirSync(INSTANCES_DIR)) {
      const metaPath = join(INSTANCES_DIR, dir, 'metadata.json');
      if (existsSync(metaPath)) {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
        
        // Get actual storage usage
        let storageUsed = 0;
        const uploadsDir = join(INSTANCES_DIR, dir, 'uploads');
        if (existsSync(uploadsDir)) {
          try {
            const { stdout } = await execAsync(`du -sb ${uploadsDir} 2>/dev/null | cut -f1`);
            storageUsed = parseInt(stdout.trim()) || 0;
          } catch {}
        }

        instances.push({
          ...meta,
          storage_used_bytes: storageUsed,
          storage_used_gb: (storageUsed / 1024 / 1024 / 1024).toFixed(2),
        });

        totalStorage += storageUsed;
        if (meta.status === 'active') activeCount++;
      }
    }
  }

  // Get MRR from Stripe
  let mrr = 0;
  try {
    const subs = await stripe.subscriptions.list({ status: 'active', limit: 100 });
    mrr = subs.data.reduce((sum, sub) => {
      return sum + (sub.items.data[0]?.price?.unit_amount || 0);
    }, 0) / 100;
  } catch {}

  return {
    total_instances: instances.length,
    active_instances: activeCount,
    stopped_instances: instances.length - activeCount,
    total_storage_gb: (totalStorage / 1024 / 1024 / 1024).toFixed(2),
    mrr_chf: mrr,
    instances,
  };
}

// =============================================================================
// Dashboard HTML
// =============================================================================
app.get('/', async (req, res) => {
  const stats = await getStats();
  
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>SPhoto Stats</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <meta http-equiv="refresh" content="60">
</head>
<body class="bg-gray-900 text-white p-8">
  <div class="max-w-6xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">
      <span class="text-red-600">S</span>Photo Stats
    </h1>
    
    <div class="grid grid-cols-4 gap-4 mb-8">
      <div class="bg-gray-800 p-6 rounded-lg">
        <div class="text-4xl font-bold text-green-500">${stats.active_instances}</div>
        <div class="text-gray-400">Aktive Instanzen</div>
      </div>
      <div class="bg-gray-800 p-6 rounded-lg">
        <div class="text-4xl font-bold text-yellow-500">${stats.stopped_instances}</div>
        <div class="text-gray-400">Gestoppt</div>
      </div>
      <div class="bg-gray-800 p-6 rounded-lg">
        <div class="text-4xl font-bold text-blue-500">${stats.total_storage_gb} GB</div>
        <div class="text-gray-400">Speicher genutzt</div>
      </div>
      <div class="bg-gray-800 p-6 rounded-lg">
        <div class="text-4xl font-bold text-emerald-500">CHF ${stats.mrr_chf}</div>
        <div class="text-gray-400">Monatlich (MRR)</div>
      </div>
    </div>

    <div class="bg-gray-800 rounded-lg overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-700">
          <tr>
            <th class="text-left p-4">ID</th>
            <th class="text-left p-4">E-Mail</th>
            <th class="text-left p-4">Plan</th>
            <th class="text-left p-4">Speicher</th>
            <th class="text-left p-4">Status</th>
            <th class="text-left p-4">Erstellt</th>
          </tr>
        </thead>
        <tbody>
          ${stats.instances.map(i => `
            <tr class="border-t border-gray-700">
              <td class="p-4 font-mono text-sm">${i.id}</td>
              <td class="p-4">${i.email}</td>
              <td class="p-4">${i.plan}</td>
              <td class="p-4">${i.storage_used_gb} / ${i.storage_gb} GB</td>
              <td class="p-4">
                <span class="px-2 py-1 rounded text-xs ${i.status === 'active' ? 'bg-green-600' : 'bg-red-600'}">
                  ${i.status}
                </span>
              </td>
              <td class="p-4 text-sm text-gray-400">${new Date(i.created).toLocaleDateString('de-CH')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <p class="text-gray-500 text-sm mt-4">Auto-refresh alle 60 Sekunden</p>
  </div>
</body>
</html>
  `);
});

app.get('/api/stats', async (req, res) => {
  res.json(await getStats());
});

app.listen(3000, () => console.log('Stats server on :3000'));

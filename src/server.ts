import { config } from './config.js';
import { Store } from './store.js';
import { Immich } from './immich.js';
import { Billing } from './billing.js';
import { createApp } from './app.js';

const cfg = config(process.env);
const store = new Store(cfg.DATABASE_PATH, cfg.SESSION_SECRET);
const immich = new Immich(cfg);
await immich.bootstrap();
const billing = new Billing(cfg, store, immich);
const server = createApp(cfg, store, immich, billing).listen(cfg.PORT, '0.0.0.0', () => console.log(`SPhoto listening on port ${cfg.PORT}`));
let running = false;
async function job() {
  if (running) return;
  running = true;
  try { await billing.reconcile(); }
  catch { console.error('Scheduled reconciliation failed; see operator dashboard.'); }
  finally { running = false; }
}
void job();
const interval = setInterval(() => { void job(); }, 15 * 60000);
interval.unref();
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    clearInterval(interval);
    server.close(() => { store.close(); process.exit(0); });
  });
}

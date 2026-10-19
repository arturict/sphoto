import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { planSchema, plans, quota, type Config } from './config.js';
import { HttpError, type Immich } from './immich.js';
import type { Store } from './store.js';
import type { Billing } from './billing.js';
import { authForm, bytes, errorPage, escape, home, page, pricing } from './views.js';

const credentials = z.object({ email: z.email().max(254).transform(s => s.toLowerCase().trim()), password: z.string().min(1).max(128) });
const signup = credentials.extend({ name: z.string().trim().min(1).max(100), password: z.string().min(12).max(128) });
const cookieName = 'sphoto_session';
const cookie = (req: Request) => req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? '';

export function createApp(cfg: Config, store: Store, immich: Immich, billing: Billing) {
  const app = express();
  app.disable('x-powered-by');
  // A no-referrer policy makes Chromium send Origin: null for local HTTP forms.
  app.use(helmet({ referrerPolicy: { policy: 'same-origin' }, contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } }, strictTransportSecurity: cfg.PUBLIC_URL.startsWith('https:') }));
  app.use((_req, res, next) => { res.setHeader('cache-control', 'no-store'); next(); });
  app.post('/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    await billing.webhook(z.instanceof(Buffer).parse(req.body), req.get('stripe-signature') ?? '');
    res.json({ received: true });
  });
  // Browser POSTs must come from this exact origin, including unauthenticated forms (login CSRF).
  app.use((req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== cfg.PUBLIC_URL) return next(new HttpError(403, 'Request origin is not allowed. Open SPhoto directly and try again.'));
    next();
  });
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));
  const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });
  app.use(['/signup', '/login'], authLimit);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 ** 2, files: 1, fields: 2 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) });

  function session(req: Request) {
    const found = store.getSession(cookie(req));
    if (!found) throw new HttpError(401, 'Please sign in to continue.');
    return found;
  }
  async function admin(req: Request) {
    const found = session(req);
    const user = await immich.user(found.token);
    if (!user.isAdmin) throw new HttpError(403, 'Only the operator can access this page.');
    return user;
  }
  function setSession(res: Response, userId: string, token: string) {
    res.cookie(cookieName, store.session(userId, token), { httpOnly: true, sameSite: 'strict', secure: cfg.PUBLIC_URL.startsWith('https:'), maxAge: 7 * 86400000, path: '/' });
  }
  app.get('/style.css', (_req, res) => res.sendFile('style.css', { root: 'public' }));
  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => { await immich.ping(); res.json({ status: 'ok' }); });
  app.get('/', (_req, res) => res.send(home()));
  app.get('/signup', (_req, res) => res.send(authForm(true)));
  app.get('/login', (_req, res) => res.send(authForm(false)));
  app.post('/signup', async (req, res) => {
    const input = signup.parse(req.body);
    const created = await immich.createUser(input.email, input.name, input.password, quota('free'));
    store.addUser(created);
    const login = await immich.login(input.email, input.password);
    setSession(res, login.userId, login.accessToken);
    res.redirect(303, '/library');
  });
  app.post('/login', async (req, res) => {
    const input = credentials.parse(req.body);
    const login = await immich.login(input.email, input.password);
    if (!login.isAdmin && !store.user(login.userId)) throw new HttpError(403, 'This Immich account is not managed by SPhoto. Contact the operator.');
    setSession(res, login.userId, login.accessToken);
    res.redirect(303, login.isAdmin ? '/admin' : '/library');
  });
  app.post('/logout', async (req, res) => {
    const found = store.getSession(cookie(req));
    store.deleteSession(cookie(req));
    res.clearCookie(cookieName, { path: '/' });
    if (found) await immich.request('/auth/logout', found.token, { method: 'POST' }).catch(() => undefined);
    res.redirect(303, '/login');
  });
  app.get('/library', async (req, res) => {
    const found = session(req);
    const user = await immich.user(found.token);
    if (user.isAdmin) return res.redirect('/admin');
    const account = store.user(user.id);
    if (!account) throw new HttpError(403, 'This account is not managed by SPhoto.');
    const currentPage = z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page);
    const assets = await immich.assets(found.token, currentPage);
    const notice = z.string().max(180).optional().parse(req.query.notice);
    res.send(page('Your library', `<section><p class="eyebrow">Your private library</p><h1>Hello, ${escape(user.name)}.</h1>${notice ? `<p class="notice" role="status">${escape(notice)}</p>` : ''}<div class="summary card"><div><strong>${plans[account.plan].name}</strong><p>${bytes(user.quotaUsageInBytes)} of ${plans[account.plan].gb} GB used</p><meter min="0" max="${quota(account.plan)}" value="${Math.min(user.quotaUsageInBytes, quota(account.plan))}" aria-label="Storage used"></meter>${user.quotaUsageInBytes >= quota(account.plan) ? '<p role="alert">Your library is full. Download originals or upgrade your plan to upload more.</p>' : ''}</div><form method="post" action="/upload" enctype="multipart/form-data"><label>Add a photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><small>JPEG, PNG or WebP · Up to 25 MB per photo</small><button>Upload photo</button></form></div><h2>Your photos</h2>${assets.items.length ? `<div class="gallery">${assets.items.map(asset => `<figure><a href="/photos/${escape(asset.id)}/original" download><img src="/photos/${escape(asset.id)}/thumbnail" alt="${escape(asset.originalFileName)}" loading="lazy"></a><figcaption>${escape(asset.originalFileName)} <a href="/photos/${escape(asset.id)}/original" download>Download original</a></figcaption></figure>`).join('')}</div>` : '<div class="empty card"><h3>No photos here yet</h3><p>Upload your first photo above. Your originals stay in Immich.</p></div>'}<nav aria-label="Library pages">${currentPage > 1 ? `<a href="/library?page=${currentPage - 1}">Previous</a>` : ''}${assets.nextPage ? `<a href="/library?page=${escape(assets.nextPage)}">Next</a>` : ''}</nav></section><section><h2>Space to grow</h2><p>${billing.stripe ? 'Manage or cancel your subscription through Stripe. Plan changes follow confirmed billing state.' : 'Online payments are disabled. The operator can activate a plan; the prices below are the product rates.'}</p>${account.customer && billing.stripe ? '<form method="post" action="/billing"><button>Manage billing</button></form>' : ''}${pricing(true, Boolean(billing.stripe))}</section>`, true));
  });
  app.post('/upload', (req, _res, next) => { session(req); next(); }, upload.single('photo'), async (req, res) => {
    const found = session(req);
    const user = await immich.user(found.token);
    if (!store.user(user.id)) throw new HttpError(403, 'Upload is available to SPhoto accounts.');
    if (!req.file) throw new HttpError(400, 'Choose a JPEG, PNG or WebP photo.');
    if (user.quotaSizeInBytes === null || user.quotaUsageInBytes + req.file.size > user.quotaSizeInBytes) throw new HttpError(413, 'Your library is full. Upgrade your plan or free up space before uploading.');
    await immich.upload(found.token, req.file);
    res.redirect(303, '/library?notice=Photo+received.+The+thumbnail+may+take+a+moment.');
  });
  app.get('/photos/:id/:variant', async (req, res) => {
    const found = session(req);
    const id = z.uuid().parse(req.params.id);
    const variant = z.enum(['original', 'thumbnail']).parse(req.params.variant);
    // Authorization uses the customer's Immich token, never the administrator token.
    let upstream: globalThis.Response;
    try { upstream = await immich.request(`/assets/${id}/${variant}`, found.token); }
    catch (error) {
      if (variant !== 'thumbnail' || !(error instanceof HttpError) || error.status !== 404) throw error;
      // Immich generates thumbnails asynchronously; show the authorized original in the meantime.
      upstream = await immich.request(`/assets/${id}/original`, found.token);
    }
    res.type(upstream.headers.get('content-type') ?? 'application/octet-stream');
    if (variant === 'original') {
      const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[upstream.headers.get('content-type') ?? ''] ?? '.photo';
      res.attachment(`${id}${extension}`);
    }
    res.send(Buffer.from(await upstream.arrayBuffer()));
  });
  app.post('/checkout', async (req, res) => {
    const found = session(req);
    const user = store.user(found.userId);
    if (!user) throw new HttpError(404, 'Account not found.');
    const { plan } = z.object({ plan: z.enum(['basic', 'pro']) }).parse(req.body);
    res.redirect(303, await billing.checkout(user, plan));
  });
  app.post('/billing', async (req, res) => {
    const found = session(req);
    const user = store.user(found.userId);
    if (!user) throw new HttpError(404, 'Account not found.');
    res.redirect(303, await billing.portal(user));
  });
  app.get('/admin', async (req, res) => {
    await admin(req);
    const users = await Promise.all(store.users().map(async user => ({ ...user, remote: await immich.adminUser(user.id) })));
    res.send(page('Operator dashboard', `<section><p class="eyebrow">Operator dashboard</p><h1>A clear view of your cloud.</h1><div class="metrics"><article class="card"><strong>${users.length}</strong><p>Managed accounts</p></article><article class="card"><strong>${bytes(users.reduce((sum, u) => sum + u.remote.quotaUsageInBytes, 0))}</strong><p>Original storage used</p></article><article class="card"><strong>CHF ${users.reduce((sum, u) => sum + plans[u.plan].chf, 0)}</strong><p>Monthly plan value · ${escape(cfg.BILLING_MODE)} billing<br>Not verified collected revenue</p></article></div><h2>Accounts and quotas</h2>${users.length ? `<div class="table-wrap"><table><thead><tr><th>Email</th><th>Plan</th><th>Storage</th><th>Plan change</th></tr></thead><tbody>${users.map(u => `<tr><td>${escape(u.email)}</td><td>${escape(plans[u.plan].name)}</td><td>${bytes(u.remote.quotaUsageInBytes)} / ${bytes(u.remote.quotaSizeInBytes ?? 0)}</td><td>${billing.stripe ? 'Managed by Stripe' : `<form method="post" action="/admin/plan"><input name="id" type="hidden" value="${escape(u.id)}"><label class="sr-only" for="plan-${escape(u.id)}">Plan for ${escape(u.email)}</label><select id="plan-${escape(u.id)}" name="plan">${Object.entries(plans).map(([id, p]) => `<option value="${id}" ${id === u.plan ? 'selected' : ''}>${p.name}</option>`).join('')}</select><button>Save plan</button></form>`}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">No customers yet. New sign-ups appear here.</div>'}<h2>Automation</h2><p>Every 15 minutes: check storage health, reconcile billing and quotas, and expire sessions. Failed runs remain visible and can be retried.</p><form method="post" action="/admin/reconcile"><button>Run reconciliation now</button></form><pre>${escape(JSON.stringify(store.jobs(), null, 2))}</pre></section>`, true, true));
  });
  app.post('/admin/plan', async (req, res) => {
    await admin(req);
    const input = z.object({ id: z.uuid(), plan: planSchema }).parse(req.body);
    await billing.manualPlan(input.id, input.plan);
    res.redirect(303, '/admin');
  });
  app.post('/admin/reconcile', async (req, res) => { await admin(req); await billing.reconcile(); res.redirect(303, '/admin'); });
  app.use((_req, _res, next) => next(new HttpError(404, 'This page does not exist.')));
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : error instanceof multer.MulterError ? 413 : 500;
    const message = error instanceof HttpError ? error.message : error instanceof z.ZodError ? 'Check the form fields and try again. Names are required; new passwords need at least 12 characters.' : error instanceof multer.MulterError ? 'Choose one photo smaller than 25 MB.' : 'The request could not be completed. Try again or contact the operator.';
    if (status >= 500) console.error('Request failed', error instanceof Error ? error.name : 'Unknown error');
    res.status(status).send(errorPage(status, message));
  };
  app.use(errorHandler);
  return app;
}

import express from 'express';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { config } from '../src/config.js';
import { Store } from '../src/store.js';
import { Immich } from '../src/immich.js';
import { Billing } from '../src/billing.js';
import { createApp } from '../src/app.js';
import type { Server } from 'node:http';

export async function listen(app: ReturnType<typeof express>) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test server address');
  return { server, url: `http://127.0.0.1:${address.port}` };
}
export const close = (server: Server) => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); });
export async function fixture() {
  const accounts = new Map<string, { id: string; email: string; name: string; password: string; isAdmin: boolean; quotaSizeInBytes: number | null; quotaUsageInBytes: number }>();
  const tokens = new Map<string, string>();
  const assets = new Map<string, { id: string; owner: string; originalFileName: string; type: string }>();
  let available = true;
  const mock = express();
  mock.use(express.json());
  mock.use((req, res, next) => { if (!available) return res.status(503).json({ error: 'offline' }); next(); });
  mock.get('/api/server/ping', (_req, res) => res.json({ res: 'pong' }));
  mock.get('/api/server/config', (_req, res) => res.json({ isInitialized: accounts.size > 0 }));
  mock.post('/api/auth/admin-sign-up', (req, res) => {
    const id = randomUUID();
    accounts.set(id, { ...req.body, id, isAdmin: true, quotaSizeInBytes: null, quotaUsageInBytes: 0 });
    res.status(201).json(accounts.get(id));
  });
  mock.post('/api/auth/login', (req, res) => {
    const account = [...accounts.values()].find(a => a.email === req.body.email && a.password === req.body.password);
    if (!account) return res.status(401).json({ error: 'credentials' });
    const token = randomUUID();
    tokens.set(token, account.id);
    res.status(201).json({ accessToken: token, userId: account.id, isAdmin: account.isAdmin });
  });
  mock.use((req, res, next) => {
    const id = tokens.get(req.get('authorization')?.slice(7) ?? '');
    const account = id ? accounts.get(id) : undefined;
    if (!account) return res.status(401).json({ error: 'unauthorized' });
    res.locals.account = account;
    next();
  });
  const schema = z.object({ id: z.string(), email: z.string(), name: z.string(), password: z.string(), isAdmin: z.boolean(), quotaSizeInBytes: z.number().nullable(), quotaUsageInBytes: z.number() });
  mock.get('/api/users/me', (_req, res) => res.json(res.locals.account));
  mock.post('/api/auth/logout', (req, res) => { tokens.delete(req.get('authorization')?.slice(7) ?? ''); res.status(201).json({}); });
  mock.use('/api/admin', (_req, res, next) => { if (!schema.parse(res.locals.account).isAdmin) return res.sendStatus(403); next(); });
  mock.post('/api/admin/users', (req, res) => {
    if ([...accounts.values()].some(a => a.email === req.body.email)) return res.status(400).json({ error: 'duplicate' });
    const id = randomUUID();
    accounts.set(id, { ...req.body, id, isAdmin: false, quotaUsageInBytes: 0 });
    res.status(201).json(accounts.get(id));
  });
  mock.get('/api/admin/users/:id', (req, res) => res.json(accounts.get(req.params.id)));
  mock.put('/api/admin/users/:id', (req, res) => {
    const account = accounts.get(req.params.id);
    if (!account) return res.sendStatus(404);
    account.quotaSizeInBytes = req.body.quotaSizeInBytes;
    res.json(account);
  });
  mock.post('/api/search/metadata', (_req, res) => res.json({ assets: { items: [...assets.values()].filter(a => a.owner === schema.parse(res.locals.account).id), nextPage: null } }));
  mock.post('/api/assets', express.raw({ type: 'multipart/form-data', limit: '26mb' }), (_req, res) => {
    const account = schema.parse(res.locals.account);
    if (account.quotaSizeInBytes !== null && account.quotaUsageInBytes >= account.quotaSizeInBytes) return res.sendStatus(400);
    const id = randomUUID();
    assets.set(id, { id, owner: account.id, originalFileName: 'test.png', type: 'IMAGE' });
    res.status(201).json({ id, status: 'created' });
  });
  mock.get('/api/assets/:id/:variant', (req, res) => {
    const asset = assets.get(req.params.id);
    if (!asset || asset.owner !== schema.parse(res.locals.account).id) return res.sendStatus(404);
    res.type('image/png').send(Buffer.from('synthetic photo'));
  });
  const remote = await listen(mock);
  const cfg = config({ ADMIN_EMAIL: 'operator@example.test', ADMIN_PASSWORD: 'synthetic operator password', SESSION_SECRET: 'synthetic session secret at least 32 chars', IMMICH_URL: remote.url });
  const store = new Store(':memory:', cfg.SESSION_SECRET);
  const immich = new Immich(cfg);
  await immich.bootstrap();
  const billing = new Billing(cfg, store, immich);
  const app = await listen(createApp(cfg, store, immich, billing));
  const request = (path: string, init: RequestInit = {}) => fetch(`${app.url}${path}`, { ...init, redirect: 'manual' });
  const post = (path: string, body: Record<string, string>, cookie = '') => request(path, { method: 'POST', headers: { origin: cfg.PUBLIC_URL, cookie }, body: new URLSearchParams(body) });
  const signUp = async (email: string) => {
    const response = await post('/signup', { email, name: '<Test User>', password: 'synthetic customer password' });
    if (response.status !== 303) throw new Error(`Signup failed: ${response.status}`);
    return response.headers.get('set-cookie')?.split(';')[0] ?? '';
  };
  return { cfg, store, immich, billing, accounts, tokens, assets, request, post, signUp, setAvailable: (value: boolean) => { available = value; }, cleanup: async () => { await close(app.server); await close(remote.server); store.close(); } };
}

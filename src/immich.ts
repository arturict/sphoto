import { z } from 'zod';
import type { Config } from './config.js';

export const immichUserSchema = z.object({ id: z.string(), email: z.string(), name: z.string(), isAdmin: z.boolean(), quotaSizeInBytes: z.number().nullable(), quotaUsageInBytes: z.number() });
const loginSchema = z.object({ accessToken: z.string(), userId: z.string(), isAdmin: z.boolean() });
export const assetsSchema = z.object({ assets: z.object({ items: z.array(z.object({ id: z.string(), originalFileName: z.string(), type: z.string() })), nextPage: z.string().nullable() }) });
export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export class Immich {
  private adminToken = '';
  constructor(private readonly cfg: Config) {}
  async request(path: string, token: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (typeof init.body === 'string') headers.set('content-type', 'application/json');
    let response: Response;
    try { response = await fetch(`${this.cfg.IMMICH_URL}/api${path}`, { ...init, headers, signal: AbortSignal.timeout(60000) }); }
    catch { throw new HttpError(503, 'Photo storage is unavailable. Please try again shortly.'); }
    if (!response.ok) {
      // Never expose upstream response bodies: they can contain internal paths and account details.
      const status = [400, 401, 403, 404, 409, 413].includes(response.status) ? response.status : 503;
      throw new HttpError(status, response.status === 401 ? 'Email or password is incorrect, or your session has expired.' : 'Photo storage could not complete this request. Check your input and available storage.');
    }
    return response;
  }
  async json(path: string, token: string, init: RequestInit = {}): Promise<unknown> { return (await this.request(path, token, init)).json(); }
  async login(email: string, password: string) {
    return loginSchema.parse(await this.json('/auth/login', '', { method: 'POST', body: JSON.stringify({ email, password }) }));
  }
  async bootstrap() {
    const state = z.object({ isInitialized: z.boolean() }).parse(await this.json('/server/config', ''));
    if (!state.isInitialized) {
      await this.json('/auth/admin-sign-up', '', { method: 'POST', body: JSON.stringify({ email: this.cfg.ADMIN_EMAIL, password: this.cfg.ADMIN_PASSWORD, name: 'SPhoto operator' }) });
    }
    const login = await this.login(this.cfg.ADMIN_EMAIL, this.cfg.ADMIN_PASSWORD);
    if (!login.isAdmin) throw new Error('Configured Immich account must be an administrator');
    this.adminToken = login.accessToken;
  }
  async admin(path: string, init: RequestInit = {}) {
    try { return await this.json(path, this.adminToken, init); }
    catch (error) {
      if (!(error instanceof HttpError) || error.status !== 401) throw error;
      await this.bootstrap();
      return this.json(path, this.adminToken, init);
    }
  }
  async createUser(email: string, name: string, password: string, quotaSizeInBytes: number) {
    return immichUserSchema.parse(await this.admin('/admin/users', { method: 'POST', body: JSON.stringify({ email, name, password, quotaSizeInBytes, shouldChangePassword: false }) }));
  }
  async user(token: string) { return immichUserSchema.parse(await this.json('/users/me', token)); }
  async adminUser(id: string) { return immichUserSchema.parse(await this.admin(`/admin/users/${id}`)); }
  async setQuota(id: string, bytes: number) {
    await this.admin(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ quotaSizeInBytes: bytes }) });
  }
  async assets(token: string, page: number) {
    return assetsSchema.parse(await this.json('/search/metadata', token, { method: 'POST', body: JSON.stringify({ page, size: 48, isTrashed: false, order: 'desc' }) })).assets;
  }
  async upload(token: string, file: Express.Multer.File) {
    const data = new FormData();
    data.set('assetData', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
    data.set('fileCreatedAt', new Date().toISOString());
    data.set('fileModifiedAt', new Date().toISOString());
    return z.object({ id: z.string(), status: z.string() }).parse(await this.json('/assets', token, { method: 'POST', body: data }));
  }
  async ping() { await this.json('/server/ping', ''); }
}

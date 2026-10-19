import type { InstanceName } from '@sphoto/shared';
import { z } from 'zod';
import type { Config } from '../config';
import { errorMessage, type Logger } from '../log';
import {
  ImmichError,
  type AlbumInfo,
  type AssetInfo,
  type AssetVisibility,
  type DownloadArchive,
  type ImmichGateway,
  type ImmichUsage,
  type PingResult,
  type UploadAsset,
} from './gateway';
import { multipartBody } from './multipart';

export interface AdminKeyStore {
  get(instance: InstanceName): string | undefined;
  set(instance: InstanceName, key: string): void;
}

const loginSchema = z.object({ accessToken: z.string() });
const apiKeySchema = z.object({ secret: z.string() });
const serverConfigSchema = z.object({ isInitialized: z.boolean() });
const createdUserSchema = z.object({ id: z.string() });
const statisticsSchema = z.object({
  usageByUser: z.array(
    z.object({ userId: z.string(), usage: z.number(), photos: z.number(), videos: z.number() }),
  ),
});
const searchSchema = z.object({
  assets: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        originalFileName: z.string(),
        fileCreatedAt: z.string(),
        fileModifiedAt: z.string(),
        isFavorite: z.boolean(),
        livePhotoVideoId: z.string().nullish(),
      }),
    ),
    nextCursor: z.string().nullish(),
  }),
});
const albumsSchema = z.array(z.object({ id: z.string(), albumName: z.string(), description: z.string() }));
const uploadSchema = z.object({ id: z.string(), status: z.enum(['created', 'duplicate']) });
const downloadInfoSchema = z.object({
  archives: z.array(z.object({ assetIds: z.array(z.string()), size: z.number() })),
});
const idSchema = z.object({ id: z.string() });

const ADMIN_PERMISSIONS = ['adminUser.create', 'adminUser.read', 'adminUser.update', 'adminUser.delete', 'server.statistics', 'user.read'];
const USER_PERMISSIONS = ['user.read', 'asset.read', 'asset.download', 'asset.upload', 'album.read', 'album.create'];
const SEARCH_PAGE_SIZE = 500;
const VISIBILITIES: AssetVisibility[] = ['hidden', 'timeline', 'archive'];

export class HttpImmichGateway implements ImmichGateway {
  constructor(
    private readonly config: Config,
    private readonly keys: AdminKeyStore,
    private readonly log: Logger,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  private url(instance: InstanceName, path: string): string {
    return `${this.config.instances[instance].internalUrl}/api${path}`;
  }

  private async request(instance: InstanceName, path: string, init: RequestInit & { duplex?: 'half' }): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(this.url(instance, path), init);
    } catch (err) {
      throw new ImmichError(`Immich (${instance}) nicht erreichbar: ${errorMessage(err)}`, null);
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ImmichError(`Immich (${instance}) ${init.method ?? 'GET'} ${path} -> ${response.status} ${text.slice(0, 300)}`, response.status);
    }
    return response;
  }

  private async json<S extends z.ZodType>(schema: S, instance: InstanceName, path: string, init: RequestInit): Promise<z.infer<S>> {
    const response = await this.request(instance, path, init);
    return schema.parse(await response.json());
  }

  private adminHeaders(instance: InstanceName): Record<string, string> {
    const key = this.keys.get(instance);
    if (!key) throw new ImmichError(`Immich (${instance}) ist noch nicht eingerichtet`, null);
    return { 'x-api-key': key, 'content-type': 'application/json' };
  }

  // --- bootstrap ---------------------------------------------------------------

  async ensureReady(instance: InstanceName): Promise<void> {
    await this.waitUntilUp(instance);
    const adminEmail = this.config.env.IMMICH_ADMIN_EMAIL;
    const password = this.config.instances[instance].adminPassword;

    const stored = this.keys.get(instance);
    if (stored) {
      const check = await fetch(this.url(instance, '/users/me'), { headers: { 'x-api-key': stored } }).catch(() => null);
      if (check?.ok) return;
      this.log.warn('Stored Immich admin key rejected, creating a new one', { instance });
    }

    const serverConfig = await this.json(serverConfigSchema, instance, '/server/config', {});
    if (!serverConfig.isInitialized) {
      await this.request(instance, '/auth/admin-sign-up', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, name: 'SPhoto Admin', password }),
      });
      this.log.info('Created Immich admin account', { instance });
    }

    const key = await this.createKey(instance, { email: adminEmail, password }, 'sphoto-automation', ADMIN_PERMISSIONS);
    this.keys.set(instance, key);
    this.log.info('Stored Immich admin API key', { instance });
  }

  private async waitUntilUp(instance: InstanceName, attempts = 90): Promise<void> {
    let last = 'unknown';
    for (let i = 0; i < attempts; i++) {
      const result = await this.ping(instance);
      if (result.ok) return;
      last = result.error ?? 'unknown';
      await this.sleep(2000);
    }
    throw new ImmichError(`Immich (${instance}) wurde nicht bereit: ${last}`, null);
  }

  private async createKey(
    instance: InstanceName,
    credentials: { email: string; password: string },
    name: string,
    permissions: string[],
  ): Promise<string> {
    const login = await this.json(loginSchema, instance, '/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const created = await this.json(apiKeySchema, instance, '/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${login.accessToken}` },
      body: JSON.stringify({ name, permissions }),
    });
    return created.secret;
  }

  async ping(instance: InstanceName): Promise<PingResult> {
    const started = Date.now();
    try {
      const response = await fetch(this.url(instance, '/server/ping'), { signal: AbortSignal.timeout(5000) });
      return { ok: response.ok, latencyMs: Date.now() - started, error: response.ok ? null : `HTTP ${response.status}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - started, error: errorMessage(err) };
    }
  }

  // --- admin -------------------------------------------------------------------

  async createUser(instance: InstanceName, input: { email: string; name: string; password: string; quotaBytes: number }) {
    const created = await this.json(createdUserSchema, instance, '/admin/users', {
      method: 'POST',
      headers: this.adminHeaders(instance),
      body: JSON.stringify({
        email: input.email,
        name: input.name,
        password: input.password,
        quotaSizeInBytes: input.quotaBytes,
        shouldChangePassword: true,
        notify: false,
      }),
    });
    return { id: created.id };
  }

  async setQuota(instance: InstanceName, immichUserId: string, quotaBytes: number): Promise<void> {
    await this.request(instance, `/admin/users/${immichUserId}`, {
      method: 'PUT',
      headers: this.adminHeaders(instance),
      body: JSON.stringify({ quotaSizeInBytes: quotaBytes }),
    });
  }

  async deleteUser(instance: InstanceName, immichUserId: string): Promise<void> {
    try {
      await this.request(instance, `/admin/users/${immichUserId}`, {
        method: 'DELETE',
        headers: this.adminHeaders(instance),
        body: JSON.stringify({ force: true }),
      });
    } catch (err) {
      if (err instanceof ImmichError && err.status === 404) return;
      throw err;
    }
  }

  async usage(instance: InstanceName): Promise<ImmichUsage[]> {
    const stats = await this.json(statisticsSchema, instance, '/server/statistics', { headers: this.adminHeaders(instance) });
    return stats.usageByUser.map((u) => ({ immichUserId: u.userId, usageBytes: u.usage, photos: u.photos, videos: u.videos }));
  }

  async createUserApiKey(instance: InstanceName, credentials: { email: string; password: string }): Promise<string> {
    return this.createKey(instance, credentials, 'sphoto-export', USER_PERMISSIONS);
  }

  // --- user scoped ---------------------------------------------------------------

  private userHeaders(apiKey: string): Record<string, string> {
    return { 'x-api-key': apiKey, 'content-type': 'application/json' };
  }

  async *listAssets(instance: InstanceName, apiKey: string): AsyncGenerator<AssetInfo> {
    // Search hides non-timeline assets unless asked, so each visibility is queried on its own.
    // Hidden assets come first: they hold the motion part of live photos.
    for (const visibility of VISIBILITIES) {
      let cursor: string | undefined;
      for (;;) {
        const page = await this.json(searchSchema, instance, '/search/metadata', {
          method: 'POST',
          headers: this.userHeaders(apiKey),
          body: JSON.stringify({ size: SEARCH_PAGE_SIZE, visibility, order: 'asc', ...(cursor ? { cursor } : {}) }),
        });
        for (const item of page.assets.items) {
          yield {
            id: item.id,
            originalFileName: item.originalFileName,
            fileCreatedAt: item.fileCreatedAt,
            fileModifiedAt: item.fileModifiedAt,
            isFavorite: item.isFavorite,
            visibility,
            livePhotoVideoId: item.livePhotoVideoId ?? null,
          };
        }
        if (!page.assets.nextCursor) break;
        cursor = page.assets.nextCursor;
      }
    }
  }

  async downloadAsset(instance: InstanceName, apiKey: string, assetId: string): Promise<ReadableStream<Uint8Array>> {
    const response = await this.request(instance, `/assets/${assetId}/original`, { headers: { 'x-api-key': apiKey } });
    if (!response.body) throw new ImmichError(`Immich (${instance}) lieferte keinen Inhalt für ${assetId}`, response.status);
    return response.body;
  }

  async uploadAsset(instance: InstanceName, apiKey: string, asset: UploadAsset) {
    const boundary = `sphoto-${crypto.randomUUID()}`;
    const fields: Record<string, string> = {
      fileCreatedAt: asset.fileCreatedAt,
      fileModifiedAt: asset.fileModifiedAt,
      isFavorite: String(asset.isFavorite),
      visibility: asset.visibility,
    };
    if (asset.livePhotoVideoId) fields['livePhotoVideoId'] = asset.livePhotoVideoId;
    const body = multipartBody(boundary, fields, {
      field: 'assetData',
      filename: asset.filename,
      contentType: 'application/octet-stream',
      stream: asset.stream,
    });
    const result = await this.json(uploadSchema, instance, '/assets', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
      duplex: 'half',
    });
    return { id: result.id, duplicate: result.status === 'duplicate' };
  }

  async listAlbums(instance: InstanceName, apiKey: string): Promise<AlbumInfo[]> {
    const albums = await this.json(albumsSchema, instance, '/albums', { headers: this.userHeaders(apiKey) });
    return albums.map((a) => ({ id: a.id, name: a.albumName, description: a.description }));
  }

  async listAlbumAssetIds(instance: InstanceName, apiKey: string, albumId: string): Promise<string[]> {
    const ids: string[] = [];
    for (const visibility of VISIBILITIES) {
      let cursor: string | undefined;
      for (;;) {
        const page = await this.json(searchSchema, instance, '/search/metadata', {
          method: 'POST',
          headers: this.userHeaders(apiKey),
          body: JSON.stringify({ size: SEARCH_PAGE_SIZE, visibility, albumIds: [albumId], ...(cursor ? { cursor } : {}) }),
        });
        ids.push(...page.assets.items.map((i) => i.id));
        if (!page.assets.nextCursor) break;
        cursor = page.assets.nextCursor;
      }
    }
    return ids;
  }

  async createAlbum(instance: InstanceName, apiKey: string, album: { name: string; description: string; assetIds: string[] }) {
    const created = await this.json(idSchema, instance, '/albums', {
      method: 'POST',
      headers: this.userHeaders(apiKey),
      body: JSON.stringify({ albumName: album.name, description: album.description, assetIds: album.assetIds }),
    });
    return created.id;
  }

  async planDownload(instance: InstanceName, apiKey: string, maxArchiveBytes: number): Promise<DownloadArchive[]> {
    const me = await this.json(idSchema, instance, '/users/me', { headers: this.userHeaders(apiKey) });
    const info = await this.json(downloadInfoSchema, instance, '/download/info', {
      method: 'POST',
      headers: this.userHeaders(apiKey),
      body: JSON.stringify({ userId: me.id, archiveSize: maxArchiveBytes }),
    });
    return info.archives.map((a) => ({ sizeBytes: a.size, assetIds: a.assetIds }));
  }

  async downloadArchive(instance: InstanceName, apiKey: string, assetIds: string[]): Promise<ReadableStream<Uint8Array>> {
    const response = await this.request(instance, '/download/archive', {
      method: 'POST',
      headers: this.userHeaders(apiKey),
      body: JSON.stringify({ assetIds }),
    });
    if (!response.body) throw new ImmichError(`Immich (${instance}) lieferte kein Archiv`, response.status);
    return response.body;
  }
}

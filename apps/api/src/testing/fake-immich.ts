import { createHash } from 'node:crypto';
import type { InstanceName } from '@sphoto/shared';
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
} from '../immich/gateway';

interface FakeUser {
  id: string;
  email: string;
  password: string;
  quotaBytes: number;
  apiKey: string | null;
}

interface FakeAsset {
  id: string;
  ownerId: string;
  filename: string;
  content: Uint8Array;
  sha1: string;
  fileCreatedAt: string;
  fileModifiedAt: string;
  isFavorite: boolean;
  visibility: AssetVisibility;
  livePhotoVideoId: string | null;
}

interface FakeAlbum {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  assetIds: string[];
}

const bytesOf = (text: string) => new TextEncoder().encode(text);

async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const streamOf = (data: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

/** In-memory stand-in for two Immich servers. Enforces quotas and de-duplicates uploads by content like Immich does. */
export class FakeImmich implements ImmichGateway {
  private readonly users = new Map<InstanceName, Map<string, FakeUser>>([
    ['free', new Map()],
    ['paid', new Map()],
  ]);
  private readonly assets = new Map<InstanceName, Map<string, FakeAsset>>([
    ['free', new Map()],
    ['paid', new Map()],
  ]);
  private readonly albums = new Map<InstanceName, Map<string, FakeAlbum>>([
    ['free', new Map()],
    ['paid', new Map()],
  ]);
  private counter = 0;

  readonly downInstances = new Set<InstanceName>();
  /** Filenames whose upload fails, to simulate a broken migration. */
  readonly failUploads = new Set<string>();
  readonly failCreateUser = new Set<InstanceName>();

  private id(prefix: string) {
    return `${prefix}-${++this.counter}`;
  }

  private usersOf(instance: InstanceName) {
    return this.users.get(instance) as Map<string, FakeUser>;
  }
  private assetsOf(instance: InstanceName) {
    return this.assets.get(instance) as Map<string, FakeAsset>;
  }
  private albumsOf(instance: InstanceName) {
    return this.albums.get(instance) as Map<string, FakeAlbum>;
  }

  private ensureUp(instance: InstanceName) {
    if (this.downInstances.has(instance)) throw new ImmichError(`Immich (${instance}) nicht erreichbar`, null);
  }

  private owner(instance: InstanceName, apiKey: string): FakeUser {
    this.ensureUp(instance);
    const user = [...this.usersOf(instance).values()].find((u) => u.apiKey === apiKey);
    if (!user) throw new ImmichError('Invalid API key', 401);
    return user;
  }

  // --- test helpers ------------------------------------------------------------

  findUser(instance: InstanceName, email: string): FakeUser | undefined {
    return [...this.usersOf(instance).values()].find((u) => u.email === email);
  }

  userCount(instance: InstanceName): number {
    return this.usersOf(instance).size;
  }

  quotaOf(instance: InstanceName, email: string): number | undefined {
    return this.findUser(instance, email)?.quotaBytes;
  }

  /** Puts an asset into a user's library as if they had uploaded it from the Immich app. */
  seedAsset(instance: InstanceName, email: string, input: { filename: string; content: string; visibility?: AssetVisibility; isFavorite?: boolean; livePhotoVideoId?: string; fileCreatedAt?: string }): string {
    const user = this.findUser(instance, email);
    if (!user) throw new Error(`No user ${email} on ${instance}`);
    const content = bytesOf(input.content);
    const id = this.id('asset');
    this.assetsOf(instance).set(id, {
      id,
      ownerId: user.id,
      filename: input.filename,
      content,
      sha1: createHash('sha1').update(content).digest('hex'),
      fileCreatedAt: input.fileCreatedAt ?? '2024-05-01T10:00:00.000Z',
      fileModifiedAt: input.fileCreatedAt ?? '2024-05-01T10:00:00.000Z',
      isFavorite: input.isFavorite ?? false,
      visibility: input.visibility ?? 'timeline',
      livePhotoVideoId: input.livePhotoVideoId ?? null,
    });
    return id;
  }

  seedAlbum(instance: InstanceName, email: string, name: string, assetIds: string[]): string {
    const user = this.findUser(instance, email);
    if (!user) throw new Error(`No user ${email} on ${instance}`);
    const id = this.id('album');
    this.albumsOf(instance).set(id, { id, ownerId: user.id, name, description: '', assetIds });
    return id;
  }

  assetsFor(instance: InstanceName, email: string): FakeAsset[] {
    const user = this.findUser(instance, email);
    return user ? [...this.assetsOf(instance).values()].filter((a) => a.ownerId === user.id) : [];
  }

  albumsFor(instance: InstanceName, email: string): (FakeAlbum & { filenames: string[] })[] {
    const user = this.findUser(instance, email);
    if (!user) return [];
    return [...this.albumsOf(instance).values()]
      .filter((a) => a.ownerId === user.id)
      .map((a) => ({ ...a, filenames: a.assetIds.map((id) => this.assetsOf(instance).get(id)?.filename ?? '?') }));
  }

  private usageBytes(instance: InstanceName, userId: string): number {
    return [...this.assetsOf(instance).values()].filter((a) => a.ownerId === userId).reduce((n, a) => n + a.content.length, 0);
  }

  // --- gateway -----------------------------------------------------------------

  ensureReady(): Promise<void> {
    return Promise.resolve();
  }

  ping(instance: InstanceName): Promise<PingResult> {
    const ok = !this.downInstances.has(instance);
    return Promise.resolve({ ok, latencyMs: 3, error: ok ? null : 'connection refused' });
  }

  createUser(instance: InstanceName, input: { email: string; name: string; password: string; quotaBytes: number }) {
    this.ensureUp(instance);
    if (this.failCreateUser.has(instance)) return Promise.reject(new ImmichError('createUser failed', 500));
    if (this.findUser(instance, input.email)) return Promise.reject(new ImmichError('User exists', 400));
    const id = this.id('user');
    this.usersOf(instance).set(id, { id, email: input.email, password: input.password, quotaBytes: input.quotaBytes, apiKey: null });
    return Promise.resolve({ id });
  }

  setQuota(instance: InstanceName, immichUserId: string, quotaBytes: number): Promise<void> {
    this.ensureUp(instance);
    const user = this.usersOf(instance).get(immichUserId);
    if (!user) return Promise.reject(new ImmichError('Not found', 404));
    user.quotaBytes = quotaBytes;
    return Promise.resolve();
  }

  deleteUser(instance: InstanceName, immichUserId: string): Promise<void> {
    this.ensureUp(instance);
    this.usersOf(instance).delete(immichUserId);
    for (const [id, asset] of this.assetsOf(instance)) if (asset.ownerId === immichUserId) this.assetsOf(instance).delete(id);
    for (const [id, album] of this.albumsOf(instance)) if (album.ownerId === immichUserId) this.albumsOf(instance).delete(id);
    return Promise.resolve();
  }

  usage(instance: InstanceName): Promise<ImmichUsage[]> {
    this.ensureUp(instance);
    return Promise.resolve(
      [...this.usersOf(instance).values()].map((u) => {
        const mine = [...this.assetsOf(instance).values()].filter((a) => a.ownerId === u.id);
        return {
          immichUserId: u.id,
          usageBytes: this.usageBytes(instance, u.id),
          photos: mine.filter((a) => !a.filename.endsWith('.mp4')).length,
          videos: mine.filter((a) => a.filename.endsWith('.mp4')).length,
        };
      }),
    );
  }

  createUserApiKey(instance: InstanceName, credentials: { email: string; password: string }): Promise<string> {
    this.ensureUp(instance);
    const user = this.findUser(instance, credentials.email);
    if (!user || user.password !== credentials.password) return Promise.reject(new ImmichError('Incorrect email or password', 401));
    user.apiKey = `key-${this.id('k')}`;
    return Promise.resolve(user.apiKey);
  }

  listAssets(instance: InstanceName, apiKey: string): AsyncIterable<AssetInfo> {
    const user = this.owner(instance, apiKey);
    const order: AssetVisibility[] = ['hidden', 'timeline', 'archive'];
    const items: AssetInfo[] = [];
    for (const visibility of order) {
      for (const asset of this.assetsOf(instance).values()) {
        if (asset.ownerId !== user.id || asset.visibility !== visibility) continue;
        items.push({
          id: asset.id,
          originalFileName: asset.filename,
          fileCreatedAt: asset.fileCreatedAt,
          fileModifiedAt: asset.fileModifiedAt,
          isFavorite: asset.isFavorite,
          visibility: asset.visibility,
          livePhotoVideoId: asset.livePhotoVideoId,
        });
      }
    }
    return ReadableStream.from(items);
  }

  downloadAsset(instance: InstanceName, apiKey: string, assetId: string): Promise<ReadableStream<Uint8Array>> {
    const user = this.owner(instance, apiKey);
    const asset = this.assetsOf(instance).get(assetId);
    if (!asset || asset.ownerId !== user.id) return Promise.reject(new ImmichError('Not found', 404));
    return Promise.resolve(streamOf(asset.content));
  }

  async uploadAsset(instance: InstanceName, apiKey: string, upload: UploadAsset) {
    const user = this.owner(instance, apiKey);
    if (this.failUploads.has(upload.filename)) throw new ImmichError(`upload of ${upload.filename} failed`, 500);
    const content = await drain(upload.stream);
    const sha1 = createHash('sha1').update(content).digest('hex');
    const existing = [...this.assetsOf(instance).values()].find((a) => a.ownerId === user.id && a.sha1 === sha1);
    if (existing) return { id: existing.id, duplicate: true };
    if (this.usageBytes(instance, user.id) + content.length > user.quotaBytes) throw new ImmichError('Quota has been exceeded!', 400);
    const id = this.id('asset');
    this.assetsOf(instance).set(id, {
      id,
      ownerId: user.id,
      filename: upload.filename,
      content,
      sha1,
      fileCreatedAt: upload.fileCreatedAt,
      fileModifiedAt: upload.fileModifiedAt,
      isFavorite: upload.isFavorite,
      visibility: upload.visibility,
      livePhotoVideoId: upload.livePhotoVideoId,
    });
    return { id, duplicate: false };
  }

  listAlbums(instance: InstanceName, apiKey: string): Promise<AlbumInfo[]> {
    const user = this.owner(instance, apiKey);
    return Promise.resolve(
      [...this.albumsOf(instance).values()].filter((a) => a.ownerId === user.id).map((a) => ({ id: a.id, name: a.name, description: a.description })),
    );
  }

  listAlbumAssetIds(instance: InstanceName, apiKey: string, albumId: string): Promise<string[]> {
    this.owner(instance, apiKey);
    return Promise.resolve(this.albumsOf(instance).get(albumId)?.assetIds ?? []);
  }

  createAlbum(instance: InstanceName, apiKey: string, album: { name: string; description: string; assetIds: string[] }): Promise<string> {
    const user = this.owner(instance, apiKey);
    const id = this.id('album');
    this.albumsOf(instance).set(id, { id, ownerId: user.id, name: album.name, description: album.description, assetIds: album.assetIds });
    return Promise.resolve(id);
  }

  planDownload(instance: InstanceName, apiKey: string, maxArchiveBytes: number): Promise<DownloadArchive[]> {
    const user = this.owner(instance, apiKey);
    const archives: DownloadArchive[] = [];
    let current: DownloadArchive = { sizeBytes: 0, assetIds: [] };
    for (const asset of this.assetsOf(instance).values()) {
      if (asset.ownerId !== user.id) continue;
      if (current.assetIds.length > 0 && current.sizeBytes + asset.content.length > maxArchiveBytes) {
        archives.push(current);
        current = { sizeBytes: 0, assetIds: [] };
      }
      current.assetIds.push(asset.id);
      current.sizeBytes += asset.content.length;
    }
    if (current.assetIds.length > 0) archives.push(current);
    return Promise.resolve(archives);
  }

  downloadArchive(instance: InstanceName, apiKey: string, assetIds: string[]): Promise<ReadableStream<Uint8Array>> {
    const user = this.owner(instance, apiKey);
    const parts = assetIds.map((id) => this.assetsOf(instance).get(id)).filter((a): a is FakeAsset => a !== undefined && a.ownerId === user.id);
    return Promise.resolve(streamOf(bytesOf(`ZIP[${parts.map((a) => a.filename).join(',')}]`)));
  }
}

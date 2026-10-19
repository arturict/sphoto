import type { InstanceName } from '@sphoto/shared';

// The slice of Immich that SPhoto needs. Written against the Immich v3 OpenAPI spec.
// HttpImmichGateway talks to a real server; tests use FakeImmich.

export interface ImmichUsage {
  immichUserId: string;
  usageBytes: number;
  photos: number;
  videos: number;
}

export type AssetVisibility = 'timeline' | 'archive' | 'hidden';

export interface AssetInfo {
  id: string;
  originalFileName: string;
  fileCreatedAt: string;
  fileModifiedAt: string;
  isFavorite: boolean;
  visibility: AssetVisibility;
  livePhotoVideoId: string | null;
}

export interface UploadAsset {
  stream: ReadableStream<Uint8Array>;
  filename: string;
  fileCreatedAt: string;
  fileModifiedAt: string;
  isFavorite: boolean;
  visibility: AssetVisibility;
  livePhotoVideoId: string | null;
}

export interface AlbumInfo {
  id: string;
  name: string;
  description: string;
}

export interface DownloadArchive {
  sizeBytes: number;
  assetIds: string[];
}

export interface PingResult {
  ok: boolean;
  latencyMs: number;
  error: string | null;
}

export class ImmichError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ImmichError';
  }
}

export interface ImmichGateway {
  /** Creates the admin account and the automation API key if the instance does not have them yet. */
  ensureReady(instance: InstanceName): Promise<void>;
  ping(instance: InstanceName): Promise<PingResult>;

  // Admin operations (use the instance's automation key).
  createUser(instance: InstanceName, input: { email: string; name: string; password: string; quotaBytes: number }): Promise<{ id: string }>;
  setQuota(instance: InstanceName, immichUserId: string, quotaBytes: number): Promise<void>;
  deleteUser(instance: InstanceName, immichUserId: string): Promise<void>;
  usage(instance: InstanceName): Promise<ImmichUsage[]>;

  /** Logs in as the user once and returns a scoped API key SPhoto keeps for exports and migrations. */
  createUserApiKey(instance: InstanceName, credentials: { email: string; password: string }): Promise<string>;

  // User-scoped operations (use the user's key).
  listAssets(instance: InstanceName, apiKey: string): AsyncIterable<AssetInfo>;
  downloadAsset(instance: InstanceName, apiKey: string, assetId: string): Promise<ReadableStream<Uint8Array>>;
  uploadAsset(instance: InstanceName, apiKey: string, asset: UploadAsset): Promise<{ id: string; duplicate: boolean }>;
  listAlbums(instance: InstanceName, apiKey: string): Promise<AlbumInfo[]>;
  listAlbumAssetIds(instance: InstanceName, apiKey: string, albumId: string): Promise<string[]>;
  createAlbum(instance: InstanceName, apiKey: string, album: { name: string; description: string; assetIds: string[] }): Promise<string>;
  planDownload(instance: InstanceName, apiKey: string, maxArchiveBytes: number): Promise<DownloadArchive[]>;
  downloadArchive(instance: InstanceName, apiKey: string, assetIds: string[]): Promise<ReadableStream<Uint8Array>>;
}

import type { PortalMe } from '@sphoto/shared';

export function portalMe(overrides: Partial<PortalMe> = {}): PortalMe {
  return {
    email: 'anna@example.ch',
    tier: 'basic',
    planName: 'Basic',
    quotaGb: 100,
    usedBytes: 25 * 1024 ** 3,
    photos: 1200,
    videos: 1,
    instanceUrl: 'https://fotos.example',
    hasMl: true,
    createdAt: '2026-09-01T08:00:00.000Z',
    migrating: false,
    deletionDueAt: null,
    cancellationDueAt: null,
    canUpgrade: false,
    canManageBilling: true,
    nextExportAt: null,
    latestExport: null,
    latestJob: null,
    ...overrides,
  };
}

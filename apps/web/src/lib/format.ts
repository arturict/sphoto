const GIB = 1024 ** 3;
const TIB = 1024 ** 4;

const TIME_ZONE = 'Europe/Zurich';

const decimal = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
const chf = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' });
const date = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeZone: TIME_ZONE });
const dateTime = new Intl.DateTimeFormat('de-CH', { dateStyle: 'medium', timeStyle: 'short', timeZone: TIME_ZONE });

// Storage quotas are binary (1 GB = 1024^3 bytes), matching the API's plan limits.
export function formatBytes(bytes: number): string {
  return bytes >= TIB ? `${decimal.format(bytes / TIB)} TB` : `${decimal.format(bytes / GIB)} GB`;
}

export const formatInteger = (value: number): string => integer.format(value);

export const formatGb = (gb: number): string => `${integer.format(gb)} GB`;

export function formatChf(amount: number): string {
  return chf.format(amount);
}

export const formatDate = (iso: string): string => date.format(new Date(iso));

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

// Shared by charts, which receive plain ISO dates (YYYY-MM-DD) without a time zone.
export const formatDay = (isoDay: string): string => date.format(new Date(`${isoDay}T12:00:00Z`));

export function usagePercent(usedBytes: number, quotaGb: number): number {
  if (quotaGb <= 0) return 0;
  return Math.min(100, Math.round((usedBytes / (quotaGb * GIB)) * 100));
}

import { describe, expect, it } from 'vitest';
import { formatBytes, formatChf, formatDate, formatDateTime, formatDay, formatGb, usagePercent } from './format';

// Intl separates currency and number groups with non-breaking spaces; compare with plain spaces.
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatBytes', () => {
  it('uses binary gigabytes with two decimals below one terabyte', () => {
    expect(formatBytes(0)).toBe('0.00 GB');
    expect(formatBytes(1024 ** 3 * 1.5)).toBe('1.50 GB');
    expect(plain(formatBytes(1024 ** 3 * 999))).toBe('999.00 GB');
  });

  it('switches to terabytes from 1024 GB', () => {
    expect(formatBytes(1024 ** 4)).toBe('1.00 TB');
    expect(formatBytes(1024 ** 4 * 2.5)).toBe('2.50 TB');
  });
});

describe('formatGb', () => {
  it('prints whole quota values', () => {
    expect(formatGb(100)).toBe('100 GB');
  });
});

describe('formatChf', () => {
  it('formats Swiss francs with two decimals', () => {
    expect(plain(formatChf(4.9))).toBe('CHF 4.90');
    expect(plain(formatChf(0))).toBe('CHF 0.00');
  });
});

describe('dates', () => {
  it('formats in the Swiss locale and time zone', () => {
    expect(formatDate('2026-11-02T10:00:00.000Z')).toBe('02.11.2026');
    expect(plain(formatDateTime('2026-11-02T10:30:00.000Z'))).toContain('02.11.2026');
    expect(plain(formatDateTime('2026-11-02T10:30:00.000Z'))).toContain('11:30');
  });

  it('keeps plain calendar days on the same day', () => {
    expect(formatDay('2026-01-31')).toBe('31.01.2026');
  });

  it('uses Zurich midnight rather than UTC for the date', () => {
    expect(formatDate('2026-06-30T22:30:00.000Z')).toBe('01.07.2026');
  });
});

describe('usagePercent', () => {
  it('rounds and caps at 100', () => {
    expect(usagePercent(1024 ** 3 * 2.5, 10)).toBe(25);
    expect(usagePercent(1024 ** 3 * 50, 10)).toBe(100);
  });

  it('is zero for an empty quota', () => {
    expect(usagePercent(10, 0)).toBe(0);
  });
});

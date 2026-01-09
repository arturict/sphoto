// =============================================================================
// Utils Tests
// =============================================================================

import { describe, expect, test } from 'bun:test';
import {
  generatePassword,
  generateVisibleId,
  formatBytes,
  gbToBytes,
  bytesToGb,
  generateToken,
  calculatePercentage,
  formatDateCH,
  addDays,
  isDatePast,
  isValidEmail,
  sanitizeEmail,
} from '../utils';

describe('generatePassword', () => {
  test('generates password of default length (12)', () => {
    const password = generatePassword();
    expect(password.length).toBe(12);
  });

  test('generates password of custom length', () => {
    const password = generatePassword(20);
    expect(password.length).toBe(20);
  });

  test('generates only alphanumeric characters', () => {
    const password = generatePassword(100);
    expect(password).toMatch(/^[a-zA-Z0-9]+$/);
  });

  test('generates unique passwords', () => {
    const passwords = new Set();
    for (let i = 0; i < 100; i++) {
      passwords.add(generatePassword());
    }
    // All 100 passwords should be unique
    expect(passwords.size).toBe(100);
  });
});

describe('generateVisibleId', () => {
  test('creates id from email prefix', () => {
    const id = generateVisibleId('john.doe@example.com');
    expect(id).toMatch(/^johndoe-[a-z0-9]{4}$/);
  });

  test('handles special characters in email', () => {
    const id = generateVisibleId('user+tag@example.com');
    expect(id).toMatch(/^usertag-[a-z0-9]{4}$/);
  });

  test('truncates long email prefixes', () => {
    const id = generateVisibleId('verylongemailprefix@example.com');
    // First part should be max 10 chars
    const [base] = id.split('-');
    expect(base.length).toBeLessThanOrEqual(10);
  });

  test('lowercases the email', () => {
    const id = generateVisibleId('JOHN@example.com');
    expect(id).toMatch(/^john-[a-z0-9]{4}$/);
  });
});

describe('formatBytes', () => {
  test('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  test('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  test('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  test('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  test('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
  });

  test('formats terabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
  });
});

describe('gbToBytes', () => {
  test('converts 1 GB', () => {
    expect(gbToBytes(1)).toBe(1073741824);
  });

  test('converts 200 GB (Basic plan)', () => {
    expect(gbToBytes(200)).toBe(214748364800);
  });

  test('converts 1000 GB (Pro plan)', () => {
    expect(gbToBytes(1000)).toBe(1073741824000);
  });

  test('converts 0 GB', () => {
    expect(gbToBytes(0)).toBe(0);
  });
});

describe('bytesToGb', () => {
  test('converts bytes to GB', () => {
    expect(bytesToGb(1073741824)).toBe(1);
  });

  test('rounds to 2 decimal places', () => {
    expect(bytesToGb(1610612736)).toBe(1.5);
  });

  test('handles 0 bytes', () => {
    expect(bytesToGb(0)).toBe(0);
  });
});

describe('generateToken', () => {
  test('generates token of default length (32)', () => {
    const token = generateToken();
    expect(token.length).toBe(32);
  });

  test('generates token of custom length', () => {
    const token = generateToken(64);
    expect(token.length).toBe(64);
  });

  test('generates unique tokens', () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken());
    }
    expect(tokens.size).toBe(100);
  });
});

describe('calculatePercentage', () => {
  test('calculates percentage correctly', () => {
    expect(calculatePercentage(50, 100)).toBe(50);
    expect(calculatePercentage(25, 100)).toBe(25);
    expect(calculatePercentage(1, 3)).toBe(33);
  });

  test('handles zero total', () => {
    expect(calculatePercentage(100, 0)).toBe(0);
  });

  test('handles zero used', () => {
    expect(calculatePercentage(0, 100)).toBe(0);
  });

  test('rounds to integer', () => {
    expect(calculatePercentage(1, 3)).toBe(33);
    expect(calculatePercentage(2, 3)).toBe(67);
  });
});

describe('formatDateCH', () => {
  test('formats date string', () => {
    const result = formatDateCH('2024-12-25');
    expect(result).toBe('25.12.2024');
  });

  test('formats Date object', () => {
    const date = new Date('2024-01-15');
    const result = formatDateCH(date);
    expect(result).toBe('15.01.2024');
  });
});

describe('addDays', () => {
  test('adds days to date', () => {
    const date = new Date('2024-01-01');
    const result = addDays(date, 14);
    expect(result.getDate()).toBe(15);
  });

  test('handles month rollover', () => {
    const date = new Date('2024-01-30');
    const result = addDays(date, 5);
    expect(result.getMonth()).toBe(1); // February
  });

  test('does not mutate original date', () => {
    const date = new Date('2024-01-01');
    addDays(date, 14);
    expect(date.getDate()).toBe(1);
  });
});

describe('isDatePast', () => {
  test('returns true for past date', () => {
    expect(isDatePast('2020-01-01')).toBe(true);
  });

  test('returns false for future date', () => {
    expect(isDatePast('2030-01-01')).toBe(false);
  });

  test('handles Date objects', () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    expect(isDatePast(pastDate)).toBe(true);
  });
});

describe('isValidEmail', () => {
  test('validates correct emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name@example.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.com')).toBe(true);
  });

  test('rejects invalid emails', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('sanitizeEmail', () => {
  test('lowercases email', () => {
    expect(sanitizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
  });

  test('trims whitespace', () => {
    expect(sanitizeEmail('  user@example.com  ')).toBe('user@example.com');
  });

  test('handles mixed case and whitespace', () => {
    expect(sanitizeEmail('  User@Example.COM  ')).toBe('user@example.com');
  });
});

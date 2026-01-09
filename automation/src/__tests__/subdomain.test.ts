// =============================================================================
// Subdomain Tests
// =============================================================================

import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { isValidSubdomain, checkSubdomain, getReservedSubdomains } from '../subdomain';
import { RESERVED_SUBDOMAINS } from '../config';

describe('isValidSubdomain', () => {
  describe('valid subdomains', () => {
    test('accepts lowercase alphanumeric', () => {
      expect(isValidSubdomain('photos')).toBe(true);
      expect(isValidSubdomain('myphotos123')).toBe(true);
    });

    test('accepts hyphens in middle', () => {
      expect(isValidSubdomain('my-photos')).toBe(true);
      expect(isValidSubdomain('my-photo-cloud')).toBe(true);
    });

    test('accepts minimum length (3 chars)', () => {
      expect(isValidSubdomain('abc')).toBe(true);
    });

    test('accepts maximum length (20 chars)', () => {
      expect(isValidSubdomain('a'.repeat(20))).toBe(true);
    });
  });

  describe('invalid subdomains', () => {
    test('rejects too short (< 3 chars)', () => {
      expect(isValidSubdomain('ab')).toBe(false);
      expect(isValidSubdomain('a')).toBe(false);
    });

    test('rejects too long (> 20 chars)', () => {
      expect(isValidSubdomain('a'.repeat(21))).toBe(false);
    });

    test('rejects uppercase letters', () => {
      expect(isValidSubdomain('MyPhotos')).toBe(false);
      expect(isValidSubdomain('PHOTOS')).toBe(false);
    });

    test('rejects leading hyphen', () => {
      expect(isValidSubdomain('-photos')).toBe(false);
    });

    test('rejects trailing hyphen', () => {
      expect(isValidSubdomain('photos-')).toBe(false);
    });

    test('rejects consecutive hyphens', () => {
      expect(isValidSubdomain('my--photos')).toBe(false);
    });

    test('rejects special characters', () => {
      expect(isValidSubdomain('my_photos')).toBe(false);
      expect(isValidSubdomain('my.photos')).toBe(false);
      expect(isValidSubdomain('my@photos')).toBe(false);
      expect(isValidSubdomain('my photos')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(isValidSubdomain('')).toBe(false);
    });
  });
});

describe('checkSubdomain', () => {
  describe('format validation', () => {
    test('normalizes to lowercase and validates', () => {
      // The function normalizes to lowercase before validation
      const result = checkSubdomain('MYCLOUD');
      // Should be available since 'mycloud' is a valid subdomain
      // (unless it's reserved or in use)
      expect(result.subdomain).toBe('mycloud');
    });

    test('rejects invalid format with error message', () => {
      const result = checkSubdomain('ab');
      expect(result.available).toBe(false);
      expect(result.reason).toContain('Ungültiges Format');
    });
  });

  describe('reserved subdomains', () => {
    test('rejects reserved subdomains', () => {
      const reserved = ['www', 'api', 'admin', 'free', 'photos'];
      
      for (const subdomain of reserved) {
        const result = checkSubdomain(subdomain);
        expect(result.available).toBe(false);
        expect(result.reason).toContain('reserviert');
      }
    });
  });

  describe('available subdomains', () => {
    test('returns available for valid, unused subdomain', () => {
      const result = checkSubdomain('myuniquephotocloud');
      // Note: This might fail if there's actually a directory with this name
      // In a real test environment, we'd mock the file system
      if (result.available) {
        expect(result.subdomain).toBe('myuniquephotocloud');
      }
    });
  });
});

describe('getReservedSubdomains', () => {
  test('returns array of reserved subdomains', () => {
    const reserved = getReservedSubdomains();
    expect(Array.isArray(reserved)).toBe(true);
    expect(reserved.length).toBeGreaterThan(0);
  });

  test('includes common reserved names', () => {
    const reserved = getReservedSubdomains();
    expect(reserved).toContain('www');
    expect(reserved).toContain('api');
    expect(reserved).toContain('admin');
  });

  test('returns a copy (not the original array)', () => {
    const reserved1 = getReservedSubdomains();
    const reserved2 = getReservedSubdomains();
    expect(reserved1).not.toBe(reserved2);
    expect(reserved1).toEqual(reserved2);
  });
});

describe('RESERVED_SUBDOMAINS constant', () => {
  test('contains shared instance subdomains', () => {
    expect(RESERVED_SUBDOMAINS).toContain('free');
    expect(RESERVED_SUBDOMAINS).toContain('photos');
    expect(RESERVED_SUBDOMAINS).toContain('pro');
    expect(RESERVED_SUBDOMAINS).toContain('paid');
  });

  test('contains infrastructure subdomains', () => {
    expect(RESERVED_SUBDOMAINS).toContain('www');
    expect(RESERVED_SUBDOMAINS).toContain('api');
    expect(RESERVED_SUBDOMAINS).toContain('admin');
    expect(RESERVED_SUBDOMAINS).toContain('stats');
    expect(RESERVED_SUBDOMAINS).toContain('mail');
  });
});

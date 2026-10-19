import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';
import { TEST_ENV } from './testing/harness';

describe('loadConfig', () => {
  it('reads a complete environment and normalises URLs', () => {
    const config = loadConfig({ ...TEST_ENV, PUBLIC_URL: 'https://sphoto.test/' });
    expect(config.publicUrl).toBe('https://sphoto.test');
    expect(config.instances.free.hasMl).toBe(false);
    expect(config.instances.paid.hasMl).toBe(true);
    expect(config.quotaGb).toEqual({ free: 1, basic: 10, pro: 50 });
  });

  it('lists every problem at once instead of failing on the first', () => {
    const message = (() => {
      try {
        loadConfig({ ...TEST_ENV, ADMIN_API_KEY: 'short', PUBLIC_URL: 'nonsense' });
        return '';
      } catch (err) {
        return String(err);
      }
    })();
    expect(message).toContain('ADMIN_API_KEY');
    expect(message).toContain('PUBLIC_URL');
  });

  it('requires the credentials of the chosen mail provider', () => {
    const { SMTP_URL: _omit, ...withoutSmtp } = TEST_ENV;
    expect(() => loadConfig(withoutSmtp)).toThrow('SMTP_URL is required');
  });
});

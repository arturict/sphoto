import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { createHarness, DAY, type Harness } from '../testing/harness';
import { authenticate, exchangeMagicLink, logout, MAGIC_LINK_MINUTES, requestLogin } from './auth';
import { freeSignup } from './signup';

let h: Harness;
beforeEach(() => {
  h = createHarness();
});

const tokenFromMail = (to: string): string => {
  const mail = h.mailer.to(to).at(-1);
  const match = mail?.text.match(/token=([\w-]+)/);
  if (!match?.[1]) throw new Error('no login link in mail');
  return match[1];
};

describe('free signup', () => {
  it('creates the Immich user with the free quota, stores a scoped key and mails the password', async () => {
    const result = await freeSignup(h.ctx, { email: 'anna@example.com', clientKey: 'a' });

    expect(result.instanceUrl).toBe('https://free.sphoto.test');
    const user = h.ctx.users.findLiveByEmail('anna@example.com');
    expect(user).toMatchObject({ tier: 'free', instance: 'free', quotaGb: 1, status: 'active' });
    expect(user?.immichApiKey).toBeTruthy();
    expect(h.immich.quotaOf('free', 'anna@example.com')).toBe(1024 ** 3);

    const mail = h.mailer.to('anna@example.com')[0];
    const password = mail?.text.match(/Passwort: (\S+)/)?.[1];
    expect(password).toBe(h.immich.findUser('free', 'anna@example.com')?.password);
  });

  it('rejects an email that already has an account', async () => {
    await freeSignup(h.ctx, { email: 'anna@example.com', clientKey: 'a' });
    await expect(freeSignup(h.ctx, { email: 'anna@example.com', clientKey: 'b' })).rejects.toMatchObject({ status: 409 });
    expect(h.immich.userCount('free')).toBe(1);
  });

  it('undoes the signup when the welcome mail cannot be delivered', async () => {
    h.mailer.failNext = new Error('smtp down');
    await expect(freeSignup(h.ctx, { email: 'anna@example.com', clientKey: 'a' })).rejects.toMatchObject({ status: 502 });

    expect(h.immich.userCount('free')).toBe(0);
    expect(h.ctx.users.findLiveByEmail('anna@example.com')).toBeUndefined();
    // The address is free again, so a retry works.
    await expect(freeSignup(h.ctx, { email: 'anna@example.com', clientKey: 'a' })).resolves.toBeDefined();
  });

  it('removes the Immich user again when creating its API key fails', async () => {
    h.immich.createUserApiKey = () => Promise.reject(new Error('immich hiccup'));
    await expect(freeSignup(h.ctx, { email: 'anna@example.com', clientKey: 'a' })).rejects.toThrow('immich hiccup');
    expect(h.immich.userCount('free')).toBe(0);
  });

  it('limits signups per client', async () => {
    for (let i = 0; i < 5; i++) await freeSignup(h.ctx, { email: `u${i}@example.com`, clientKey: 'same' });
    await expect(freeSignup(h.ctx, { email: 'u9@example.com', clientKey: 'same' })).rejects.toMatchObject({ status: 429 });
    await expect(freeSignup(h.ctx, { email: 'u9@example.com', clientKey: 'other' })).resolves.toBeDefined();
  });
});

describe('portal login', () => {
  beforeEach(async () => {
    await freeSignup(h.ctx, { email: 'anna@example.com', clientKey: 'a' });
    h.mailer.sent.length = 0;
  });

  it('mails a single-use link that turns into a session', async () => {
    await requestLogin(h.ctx, 'anna@example.com');
    const token = tokenFromMail('anna@example.com');

    const { sessionToken } = exchangeMagicLink(h.ctx, token);
    expect(authenticate(h.ctx, sessionToken)?.email).toBe('anna@example.com');
    expect(() => exchangeMagicLink(h.ctx, token)).toThrow(AppError);
  });

  it('does not store the token itself', async () => {
    await requestLogin(h.ctx, 'anna@example.com');
    const token = tokenFromMail('anna@example.com');
    const rows = h.ctx.db.raw.prepare('SELECT token_hash FROM magic_links').all();
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('lets a link expire', async () => {
    await requestLogin(h.ctx, 'anna@example.com');
    const token = tokenFromMail('anna@example.com');
    h.advance((MAGIC_LINK_MINUTES + 1) * 60_000);
    expect(() => exchangeMagicLink(h.ctx, token)).toThrow('abgelaufen');
  });

  it('sends nothing for unknown addresses and does not tell the caller', async () => {
    await requestLogin(h.ctx, 'nobody@example.com');
    expect(h.mailer.sent).toHaveLength(0);
  });

  it('limits login mails per address', async () => {
    for (let i = 0; i < 8; i++) await requestLogin(h.ctx, 'anna@example.com');
    expect(h.mailer.to('anna@example.com')).toHaveLength(5);
  });

  it('ends sessions on logout and after seven days', async () => {
    await requestLogin(h.ctx, 'anna@example.com');
    const { sessionToken } = exchangeMagicLink(h.ctx, tokenFromMail('anna@example.com'));
    logout(h.ctx, sessionToken);
    expect(authenticate(h.ctx, sessionToken)).toBeNull();

    await requestLogin(h.ctx, 'anna@example.com');
    const second = exchangeMagicLink(h.ctx, tokenFromMail('anna@example.com'));
    h.advance(8 * DAY);
    expect(authenticate(h.ctx, second.sessionToken)).toBeNull();
  });
});

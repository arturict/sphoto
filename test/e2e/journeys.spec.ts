import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { z } from 'zod';
import AxeBuilder from '@axe-core/playwright';

function syntheticPng(shade = 120) {
  function chunk(type: string, data: Buffer) {
    const label = Buffer.from(type);
    let crc = 0xffffffff;
    for (const byte of Buffer.concat([label, data])) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, label, data, checksum]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(64); header.writeUInt32BE(64, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc(64 * (1 + 64 * 3));
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const i = y * 193 + 1 + x * 3; pixels[i] = x * 4; pixels[i + 1] = y * 4; pixels[i + 2] = shade;
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

test('real Immich: sign-up, upload, thumbnail, download, isolation, manual plan, job, sign-in', async ({ page, browser }) => {
  const email = `qa-${randomUUID()}@example.test`;
  const password = 'synthetic customer password 2026';
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A home for your memories.' })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByRole('link', { name: 'Create your free library' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Synthetic customer');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'No photos here yet' })).toBeVisible();
  await page.getByLabel('Add a photo').setInputFiles({ name: 'synthetic-landscape.png', mimeType: 'image/png', buffer: syntheticPng() });
  await page.getByRole('button', { name: 'Upload photo' }).click();
  await expect(page.getByRole('status')).toContainText('Photo received');
  await expect(page.getByRole('img', { name: 'synthetic-landscape.png' })).toBeVisible();
  // Thumbnail generation is asynchronous in the real Immich worker.
  await expect(async () => {
    const image = page.getByRole('img', { name: 'synthetic-landscape.png' });
    await image.evaluate((element: HTMLImageElement) => { element.src = `${element.src.split('?')[0]}?retry=${Date.now()}`; });
    expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  }).toPass({ timeout: 60000, intervals: [1000, 2000, 3000] });
  const downloadPath = await page.getByRole('link', { name: 'Download original' }).getAttribute('href');
  expect(downloadPath).toBeTruthy();
  const download = await page.request.get(downloadPath ?? '');
  expect(download.status()).toBe(200);
  expect(await download.body()).toEqual(syntheticPng());
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  await bob.goto('/signup');
  await bob.getByLabel('Name', { exact: true }).fill('Other synthetic customer');
  await bob.getByLabel('Email', { exact: true }).fill(`other-${randomUUID()}@example.test`);
  await bob.getByLabel('Password', { exact: true }).fill(password);
  await bob.getByRole('button', { name: 'Create account' }).click();
  await expect(bob.getByRole('heading', { name: 'No photos here yet' })).toBeVisible();
  expect((await bob.request.get(downloadPath ?? '')).status()).toBe(404);
  expect((await bob.request.get('/admin')).status()).toBe(403);
  await bobContext.close();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('ADMIN_PASSWORD is required for the full-stack suite');
  const operatorContext = await browser.newContext();
  const operator = await operatorContext.newPage();
  await operator.goto('/login');
  await operator.getByLabel('Email', { exact: true }).fill(process.env.ADMIN_EMAIL ?? 'operator@example.test');
  await operator.getByLabel('Password', { exact: true }).fill(adminPassword);
  await operator.getByRole('button', { name: 'Sign in' }).click();
  await expect(operator.getByRole('heading', { name: 'A clear view of your cloud.' })).toBeVisible();
  const immichUrl = process.env.IMMICH_URL ?? 'http://localhost:19283';
  const adminLogin = await operator.request.post(`${immichUrl}/api/auth/login`, { data: { email: process.env.ADMIN_EMAIL, password: adminPassword } });
  expect(adminLogin.status()).toBe(201);
  const adminToken = z.object({ accessToken: z.string() }).parse(await adminLogin.json()).accessToken;
  const customerLogin = await page.request.post(`${immichUrl}/api/auth/login`, { data: { email, password } });
  const native = z.object({ accessToken: z.string(), userId: z.string() }).parse(await customerLogin.json());
  const assetId = z.uuid().parse(downloadPath?.split('/')[2]);
  await expect.poll(async () => (await page.request.get(`${immichUrl}/api/assets/${assetId}/thumbnail`, { headers: { authorization: `Bearer ${native.accessToken}` } })).status(), { timeout: 60000 }).toBe(200);
  expect((await operator.request.put(`${immichUrl}/api/admin/users/${native.userId}`, { headers: { authorization: `Bearer ${adminToken}` }, data: { quotaSizeInBytes: 1 } })).status()).toBe(200);
  await page.getByLabel('Add a photo').setInputFiles({ name: 'over-quota.png', mimeType: 'image/png', buffer: syntheticPng(121) });
  await page.getByRole('button', { name: 'Upload photo' }).click();
  await expect(page.getByRole('alert')).toContainText('Your library is full');
  const nativeUpload = await page.request.post(`${immichUrl}/api/assets`, {
    headers: { authorization: `Bearer ${native.accessToken}` },
    multipart: { assetData: { name: 'native-over-quota.png', mimeType: 'image/png', buffer: syntheticPng(122) }, fileCreatedAt: new Date().toISOString(), fileModifiedAt: new Date().toISOString() },
  });
  expect([400, 413]).toContain(nativeUpload.status());
  await operator.getByRole('button', { name: 'Run reconciliation now' }).click();
  const row = operator.getByRole('row').filter({ hasText: email });
  await row.getByRole('combobox').selectOption('basic');
  await row.getByRole('button', { name: 'Save plan' }).click();
  await expect(row).toContainText('Basic');
  await operator.getByRole('button', { name: 'Run reconciliation now' }).click();
  await expect(operator.locator('pre')).toContainText('"error": null');
  await page.goto('/library');
  await expect(page.getByText('200 GB used')).toBeVisible();
  expect((await page.request.post('/checkout', { form: { plan: 'pro' }, headers: { origin: process.env.PUBLIC_URL ?? 'http://localhost:19000' } })).status()).toBe(503);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('incorrect');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect');
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Synthetic customer.' })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'test-results/library-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/library-desktop.png', fullPage: true });
  await operator.screenshot({ path: 'test-results/operator-desktop.png', fullPage: true });
  await operatorContext.close();
});

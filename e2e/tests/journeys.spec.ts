import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { listUsers, runMaintenance, waitUntil } from '../support/admin';
import { env } from '../support/env';
import { downloadOriginal, immichLogin, listAssetNames, uploadImage, type ImmichSession } from '../support/immich';
import { loginToPortal, passwordFrom, reloadUntil } from '../support/journey';
import { subjectsFor, waitForMail } from '../support/mailpit';
import { noisePng } from '../support/png';
import { checkoutCompleted, sendStripeEvent, subscriptionDeleted } from '../support/stripe';

// One account walks through the whole product: signup, storage limits, export, upgrade with photo
// migration, plan change, cancellation with downgrade, and deletion. Each step builds on the last.
const run = Date.now().toString(36);
const anna = `anna-${run}@sphoto.test`;
const annaCustomer = `cus_anna_${run}`;
const annaSubscription = `sub_anna_${run}`;
const photo = noisePng(600, 600); // about 1.1 MB, the free quota is about 4.3 MB

let freePassword = '';
let freeSession: ImmichSession;
let photoId = '';

test.describe.serial('customer journey', () => {
  test('the landing page lists the plans from the API', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Kostenlos starten' })).toBeVisible();
    const plans = page.locator('#preise');
    await expect(plans.getByRole('article', { name: 'Plan Basic' })).toContainText('200 GB');
    await expect(plans.getByRole('article', { name: 'Plan Pro' })).toContainText('1 TB');
    await expect(plans.getByRole('article', { name: 'Plan Basic' })).toContainText('5');
    await expect(plans.getByRole('article', { name: 'Plan Pro' })).toContainText('15');
  });

  test('free signup creates the account, rejects a repeat, and mails the credentials', async ({ page }) => {
    await page.goto('/');
    const form = page.getByRole('region', { name: 'Kostenlos starten' });
    await form.getByLabel('E-Mail-Adresse').fill(anna);
    await form.getByRole('button', { name: 'Kostenlos starten' }).click();
    await expect(form.getByRole('status')).toContainText('Konto erstellt');

    const mail = await waitForMail(anna, 'Willkommen');
    freePassword = passwordFrom(mail);
    expect(mail).toContain(env.freeUrl);

    await page.reload();
    const again = page.getByRole('region', { name: 'Kostenlos starten' });
    await again.getByLabel('E-Mail-Adresse').fill(anna);
    await again.getByRole('button', { name: 'Kostenlos starten' }).click();
    await expect(again.getByRole('alert')).toContainText('bereits registriert');
  });

  test('the mailed password works in Immich and the quota is enforced', async () => {
    const session = await immichLogin(env.freeUrl, anna, freePassword);
    expect(session, 'login with the mailed password').not.toBeNull();
    freeSession = session as ImmichSession;

    const first = await uploadImage(freeSession, 'ferien.png', photo);
    expect(first.ok, first.text).toBe(true);
    photoId = first.id ?? '';

    const tooBig = await uploadImage(freeSession, 'zu-gross.png', noisePng(1100, 1100));
    expect(tooBig.ok).toBe(false);
    expect(tooBig.text.toLowerCase()).toContain('quota');
    expect(await listAssetNames(freeSession)).toEqual(['ferien.png']);
    expect((await downloadOriginal(freeSession, photoId)).equals(photo)).toBe(true);
  });

  test('portal login reveals nothing about unknown addresses', async ({ page }) => {
    await page.goto('/portal');
    await page.getByLabel('E-Mail-Adresse').fill(`niemand-${run}@sphoto.test`);
    await page.getByRole('button', { name: 'Anmeldelink senden' }).click();
    await expect(page.getByText('Wir haben dir einen Anmeldelink geschickt')).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await subjectsFor(`niemand-${run}@sphoto.test`)).toEqual([]);
  });

  test('the dashboard shows plan, usage and the export', async ({ page }) => {
    await loginToPortal(page, anna);
    const account = page.getByRole('region', { name: 'Plan und Speicher' });
    await expect(account).toContainText('Free');
    await reloadUntil(page, async () => {
      await expect(page.getByRole('progressbar', { name: 'Speichernutzung' })).toBeVisible();
      await expect(account).toContainText(/1\s+Fotos?/, { timeout: 1000 });
    });

    await page.getByRole('button', { name: 'Export anfordern' }).click();
    const download = page.getByRole('link', { name: /Teil 1 herunterladen/ });
    await expect(download).toBeVisible({ timeout: 60_000 });
    const response = await page.request.get((await download.getAttribute('href')) ?? '');
    expect(response.status()).toBe(200);
    const zip = await response.body();
    expect(zip.subarray(0, 2).toString()).toBe('PK');
    expect(zip.includes(Buffer.from('ferien'))).toBe(true);
    await expect(page.getByText(createHash('sha256').update(zip).digest('hex'))).toBeVisible();
    await waitForMail(anna, 'Export');
  });

  test('upgrading to Pro moves the photos to the paid instance', async ({ page }) => {
    await loginToPortal(page, anna);
    let checkoutUrl = '';
    await page.route(/checkout\.stripe\.com/, (route) => {
      checkoutUrl = route.request().url();
      return route.fulfill({ contentType: 'text/html', body: '<h1>Stripe Checkout (Stand-in)</h1>' });
    });
    await page.getByRole('region', { name: 'Mehr Speicher' }).getByRole('button', { name: 'Pro wählen' }).click();
    await expect.poll(() => checkoutUrl, { message: 'redirect to the Stripe checkout URL' }).not.toBe('');
    const sessionId = checkoutUrl.match(/cs_[\w]+/)?.[0] ?? '';
    expect(sessionId).not.toBe('');

    const bad = await fetch(`${env.appUrl}/api/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': 't=1,v1=forged' }, body: '{}' });
    expect(bad.status).toBe(400);

    const paid = await checkoutCompleted({ sessionId, email: anna, plan: 'pro', customer: annaCustomer, subscription: annaSubscription });
    expect(paid.status).toBe(200);

    await page.goto(`/checkout/success?session_id=${sessionId}`);
    await expect(page.getByRole('heading', { name: 'Dein Konto ist bereit' })).toBeVisible({ timeout: 120_000 });

    const upgradeMail = await waitForMail(anna, 'Upgrade auf Pro');
    const proSession = await immichLogin(env.paidUrl, anna, passwordFrom(upgradeMail));
    expect(proSession, 'login on the paid instance').not.toBeNull();
    expect(await listAssetNames(proSession as ImmichSession)).toEqual(['ferien.png']);
    expect(await immichLogin(env.freeUrl, anna, freePassword), 'free account is gone').toBeNull();

    await page.goto('/portal');
    await expect(page.getByRole('region', { name: 'Plan und Speicher' })).toContainText('Pro');
  });

  test('stripe webhooks are idempotent and plan changes adjust the quota', async ({ page }) => {
    const event = { id: `sub_${run}`, customer: annaCustomer, items: { data: [{ price: { id: 'price_e2e_basic' } }] } };
    const first = await sendStripeEvent('customer.subscription.updated', { ...event, id: annaSubscription }, `evt_plan_${run}`);
    expect(await first.json()).toMatchObject({ outcome: 'handled' });
    const replay = await sendStripeEvent('customer.subscription.updated', { ...event, id: annaSubscription }, `evt_plan_${run}`);
    expect(await replay.json()).toMatchObject({ outcome: 'duplicate' });

    await loginToPortal(page, anna);
    await expect(page.getByRole('region', { name: 'Plan und Speicher' })).toContainText('Basic');
    await waitForMail(anna, 'Basic');
  });

  test('cancelling the subscription ends in the free plan with the photos kept', async ({ page }) => {
    const ended = await subscriptionDeleted({ customer: annaCustomer, subscription: annaSubscription });
    expect(ended.status).toBe(200);
    await loginToPortal(page, anna);
    await expect(page.getByText(/Dein Abo ist beendet/)).toBeVisible();

    await page.waitForTimeout(5000); // the grace period is a few seconds in this stack
    await runMaintenance();
    const downgradeMail = await waitForMail(anna, 'Free-Plan');
    const freeAgain = await immichLogin(env.freeUrl, anna, passwordFrom(downgradeMail));
    expect(freeAgain, 'login on the free instance after the downgrade').not.toBeNull();
    expect(await listAssetNames(freeAgain as ImmichSession)).toEqual(['ferien.png']);

    await page.goto('/portal');
    await expect(page.getByRole('region', { name: 'Plan und Speicher' })).toContainText('Free');
  });

  test('deleting the account can be cancelled, then happens after the grace period', async ({ page }) => {
    await loginToPortal(page, anna);
    await page.getByRole('button', { name: 'Konto löschen' }).click();
    await page.getByRole('button', { name: 'Konto endgültig löschen' }).click();
    await expect(page.getByText(/Dein Konto wird am .* gelöscht/)).toBeVisible();

    await page.getByRole('button', { name: 'Löschung abbrechen' }).click();
    await expect(page.getByText(/Dein Konto wird am .* gelöscht/)).toHaveCount(0);
    await page.waitForTimeout(5000);
    await runMaintenance();
    expect((await listUsers()).find((u) => u.email === anna)?.status).toBe('active');

    await page.getByRole('button', { name: 'Konto löschen' }).click();
    await page.getByRole('button', { name: 'Konto endgültig löschen' }).click();
    await expect(page.getByText(/Dein Konto wird am .* gelöscht/)).toBeVisible();
    await page.waitForTimeout(5000);
    await runMaintenance();

    await waitForMail(anna, 'gelöscht');
    await waitUntil('the account to disappear', async () => !(await listUsers()).some((u) => u.email === anna));
    await waitUntil('the Immich user to be removed', async () => (await immichLogin(env.freeUrl, anna, freePassword)) === null);
  });
});

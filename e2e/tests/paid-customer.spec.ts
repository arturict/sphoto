import { expect, test } from '@playwright/test';
import { listUsers, runMaintenance, waitUntil } from '../support/admin';
import { env } from '../support/env';
import { immichLogin, listAssetNames, uploadImage, type ImmichSession } from '../support/immich';
import { passwordFrom } from '../support/journey';
import { subjectsFor, waitForMail } from '../support/mailpit';
import { noisePng } from '../support/png';
import { checkoutCompleted, subscriptionDeleted } from '../support/stripe';

// A customer who pays directly (no free account first), and a downgrade that must not delete anything.
const run = Date.now().toString(36);
const bob = `bob-${run}@sphoto.test`;
const customer = `cus_bob_${run}`;
const subscription = `sub_bob_${run}`;

test.describe.serial('direct paid customer', () => {
  let session: ImmichSession;

  test('payment creates the account on the paid instance and refuses a second subscription', async ({ page }) => {
    const sessionId = `cs_test_bob_${run}`;
    const paid = await checkoutCompleted({ sessionId, email: bob, plan: 'basic', customer, subscription });
    expect(paid.status).toBe(200);

    const mail = await waitForMail(bob, 'Willkommen');
    const login = await immichLogin(env.paidUrl, bob, passwordFrom(mail));
    expect(login, 'login with the mailed password').not.toBeNull();
    session = login as ImmichSession;
    expect(await immichLogin(env.freeUrl, bob, passwordFrom(mail))).toBeNull();

    await page.goto(`/checkout/success?session_id=${sessionId}`);
    await expect(page.getByRole('heading', { name: 'Dein Konto ist bereit' })).toBeVisible();

    const second = await checkoutCompleted({ sessionId: `cs_test_bob2_${run}`, email: bob, plan: 'pro', customer, subscription: `sub_bob2_${run}` });
    expect(second.status).toBe(200);
    await waitForMail(env.adminMail, 'Doppelte Zahlung');
    expect((await listUsers()).filter((u) => u.email === bob)).toHaveLength(1);
  });

  test('a library larger than the free plan stays untouched when the subscription ends', async () => {
    const big = await uploadImage(session, 'gross.png', noisePng(1300, 1300)); // about 5 MB, free quota is about 4.3 MB
    expect(big.ok, big.text).toBe(true);

    expect((await subscriptionDeleted({ customer, subscription })).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await runMaintenance();

    await waitForMail(bob, 'Free-Plan');
    await waitForMail(env.adminMail, 'Downgrade blockiert');
    const user = (await listUsers()).find((u) => u.email === bob);
    expect(user).toMatchObject({ tier: 'basic', instance: 'paid', status: 'active' });
    expect(await listAssetNames(session)).toEqual(['gross.png']);

    // The notices go out once, however often the maintenance runs.
    await runMaintenance();
    await runMaintenance();
    expect((await subjectsFor(bob)).filter((s) => s.includes('Free-Plan'))).toHaveLength(1);
  });

  test('an admin deletes the account for good', async ({ page }) => {
    await page.goto('/admin');
    await page.getByLabel('Admin-Schlüssel').fill('falscher-schluessel-0123456789');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    await page.getByLabel('Admin-Schlüssel').fill(env.adminKey);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('table', { name: 'Zustand der Immich-Instanzen' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Zustand der Immich-Instanzen' }).getByText('In Ordnung')).toHaveCount(2);

    await page.getByRole('navigation', { name: 'Administration' }).getByRole('link', { name: 'Benutzer' }).click();
    await page.getByLabel('Nach E-Mail-Adresse suchen').fill(bob);
    await page.getByRole('link', { name: bob }).click();
    await page.getByLabel('Zur Bestätigung die E-Mail-Adresse des Benutzers eingeben').fill(bob);
    await page.getByRole('button', { name: 'Endgültig löschen' }).click();

    await waitUntil('the account to disappear', async () => !(await listUsers()).some((u) => u.email === bob));

    const nav = page.getByRole('navigation', { name: 'Administration' });
    await nav.getByRole('link', { name: 'Aufträge' }).click();
    await page.getByRole('button', { name: 'Wartung jetzt ausführen' }).click();
    await expect(page.getByRole('status')).toContainText('Gesundheitsprüfung');
    await nav.getByRole('link', { name: 'Statistik' }).click();
    await expect(page.getByRole('table', { name: 'Top-Benutzer nach Speicher' })).toBeVisible();
  });
});

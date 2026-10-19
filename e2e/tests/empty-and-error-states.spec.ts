import { expect, test } from '@playwright/test';
import { loginToPortal } from '../support/journey';
import { waitForMail } from '../support/mailpit';

const run = Date.now().toString(36);
const email = `leer-${run}@sphoto.test`;

test('an empty library, a used-up login link and unknown payments show clear messages', async ({ page }) => {
  await page.goto('/');
  const form = page.getByRole('region', { name: 'Kostenlos starten' });
  await form.getByLabel('E-Mail-Adresse').fill(email);
  await form.getByRole('button', { name: 'Kostenlos starten' }).click();
  await expect(form.getByRole('status')).toContainText('Konto erstellt');
  await waitForMail(email, 'Willkommen');

  await loginToPortal(page, email);
  const account = page.getByRole('region', { name: 'Plan und Speicher' });
  await expect(account).toContainText(/0\s+Fotos/);

  // Nothing to export yet: the job fails with an explanation and the cooldown is not used up.
  await page.getByRole('button', { name: 'Export anfordern' }).click();
  await expect(page.getByText('Dein Konto enthält noch keine Fotos oder Videos.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Export anfordern' })).toBeEnabled();

  // A login link works once.
  const link = (await waitForMail(email, 'Anmeldelink')).match(/https?:\/\/\S+\/portal\/login\?token=[\w-]+/)?.[0] ?? '';
  const other = await page.context().browser()?.newContext({ locale: 'de-CH' });
  const second = await other?.newPage();
  await second?.goto(link);
  await expect(second?.getByRole('alert') ?? page.locator('never')).toContainText(/ungültig|abgelaufen/);
  await other?.close();

  await page.goto('/checkout/success?session_id=cs_test_gibt_es_nicht');
  await expect(page.getByRole('heading', { name: 'Zahlung nicht gefunden' })).toBeVisible();

  await page.goto('/portal/login?token=kein-gueltiger-token-0123456789');
  await expect(page.getByRole('alert')).toBeVisible();
});

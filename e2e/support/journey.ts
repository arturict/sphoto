import { expect, type Page } from '@playwright/test';
import { linkFrom, waitForMail } from './mailpit';

/** Requests a magic link in the portal UI, follows the mailed link and lands on the dashboard. */
export async function loginToPortal(page: Page, email: string): Promise<void> {
  const after = new Date();
  await page.goto('/portal');
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByRole('button', { name: 'Anmeldelink senden' }).click();
  await expect(page.getByText('Wir haben dir einen Anmeldelink geschickt')).toBeVisible();
  const mail = await waitForMail(email, 'Anmeldelink', { after });
  await page.goto(linkFrom(mail, /https?:\/\/\S+\/portal\/login\?token=[\w-]+/));
  await expect(page.getByRole('heading', { name: 'Dein Konto', level: 1 })).toBeVisible();
}

/** Reloads the page until `check` passes. The portal reads usage from Immich with a short cache. */
export async function reloadUntil(page: Page, check: () => Promise<void>, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await check();
      return;
    } catch (err) {
      if (Date.now() > deadline) throw err;
      await page.waitForTimeout(3000);
      await page.reload();
    }
  }
}

export const passwordFrom = (mailText: string): string => {
  const match = mailText.match(/Passwort: (\S+)/);
  if (!match?.[1]) throw new Error(`No password in mail:\n${mailText}`);
  return match[1];
};

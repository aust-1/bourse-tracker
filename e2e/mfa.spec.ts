import { expect, test } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from './env';
import { login, resetData } from './support';
import { totp } from './totp';

/** Attend le pas de 30 s suivant : un code déjà accepté n'est pas réutilisable. */
async function nextStep() {
  const ms = 30_000 - (Date.now() % 30_000) + 500;
  await new Promise((r) => setTimeout(r, ms));
}

test.afterEach(async () => {
  await resetData(); // retire les facteurs MFA du compte de test
});

test('double authentification : activation, code exigé à la connexion, désactivation', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await resetData();
  await login(page);
  await page.goto('/settings');

  await page.getByRole('button', { name: 'Activer' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
  await page.getByLabel('Code', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Code incorrect');
  await page.getByLabel('Code', { exact: true }).fill(totp(secret));
  await page.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByText('Double authentification activée.')).toBeVisible();

  // nouvelle connexion : le mot de passe seul ne suffit plus
  await page.getByRole('button', { name: '[esc] déconnexion' }).click();
  await page.waitForURL('**/login');
  await page.getByPlaceholder('Email').fill(TEST_EMAIL);
  await page.getByPlaceholder('Mot de passe').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/mfa');
  await page.goto('/orders');
  await page.waitForURL('**/mfa?next=%2Forders');

  await nextStep();
  await page.getByLabel(/Code à 6 chiffres/).fill(totp(secret));
  await page.getByRole('button', { name: 'Valider' }).click();
  await page.waitForURL('**/orders');
  await expect(page.getByRole('heading', { name: 'Ordres' })).toBeVisible();

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Désactiver' }).click();
  await expect(page.getByText('Double authentification désactivée.')).toBeVisible();

  // sans facteur : connexion directe
  await page.getByRole('button', { name: '[esc] déconnexion' }).click();
  await page.waitForURL('**/login');
  await login(page);
});

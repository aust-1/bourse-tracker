import { expect, test } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from './env';
import { admin, clearMailbox, lastEmailLink, login, resetData } from './support';

const NEW_PASSWORD = 'nouveau-mot-de-passe-456';

test.afterEach(async () => {
  // les autres parcours se connectent avec le mot de passe d'origine
  const { userId } = await resetData();
  await admin.auth.admin.updateUserById(userId, { password: TEST_PASSWORD });
});

test('mot de passe oublié : lien par email, nouveau mot de passe, reconnexion', async ({
  page,
}) => {
  await resetData();
  await clearMailbox();

  await page.goto('/login');
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
  await page.waitForURL('**/forgot');
  await page.getByPlaceholder('Email').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Recevoir un lien' }).click();
  await expect(page.getByRole('status')).toContainText('Si un compte existe');

  // le lien passe par Supabase puis revient sur /auth/confirm, qui ouvre la session
  await page.goto(await lastEmailLink(TEST_EMAIL));
  await page.waitForURL('**/settings/password');
  await page.getByLabel('Nouveau mot de passe').fill(NEW_PASSWORD);
  await page.getByLabel('Confirmation').fill('autre-chose-789');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('ne correspondent pas');

  await page.getByLabel('Nouveau mot de passe').fill(NEW_PASSWORD);
  await page.getByLabel('Confirmation').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  await expect(page.getByRole('status')).toContainText('Mot de passe changé');

  // reconnexion avec le nouveau mot de passe
  await page.getByRole('button', { name: '[esc] déconnexion' }).click();
  await page.waitForURL('**/login');
  await page.getByPlaceholder('Email').fill(TEST_EMAIL);
  await page.getByPlaceholder('Mot de passe').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('/');
});

test('lien invalide : retour à la connexion avec un message', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=faux&type=recovery&next=/settings/password');
  await page.waitForURL('**/login?error=link');
  await expect(page.locator('p[role="alert"]')).toContainText('invalide ou a expiré');
});

test('mot de passe depuis les réglages', async ({ page }) => {
  await resetData();
  await login(page);
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Changer le mot de passe' }).click();
  await page.waitForURL('**/settings/password');
  await page.getByLabel('Nouveau mot de passe').fill('court');
  await page.getByLabel('Confirmation').fill('court');
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
  // minLength du navigateur : le formulaire n'est pas envoyé
  await expect(page.getByRole('status')).toHaveCount(0);
});

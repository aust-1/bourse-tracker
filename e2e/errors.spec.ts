import { expect, test } from '@playwright/test';
import { login, resetData } from './support';

test('titre inconnu : page introuvable en français, dans le cadre du site', async ({ page }) => {
  await resetData();
  await login(page);
  await page.goto('/instruments/00000000-0000-0000-0000-000000000000');
  await expect(page.getByRole('heading', { name: 'Introuvable' })).toBeVisible();
  await expect(page.getByText('This page could not be found')).toHaveCount(0);
  // en-tête et menu conservés
  await expect(page.getByRole('button', { name: /déconnexion/ })).toBeVisible();
  await page.getByRole('link', { name: 'Retour au tableau de bord' }).click();
  await page.waitForURL((url) => url.pathname === '/');
});

test('adresse inconnue : 404 en français', async ({ page }) => {
  // un visiteur non connecté est d'abord renvoyé vers /login
  await resetData();
  await login(page);
  const res = await page.goto('/cette-page-n-existe-pas');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /ERREUR 404/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retour à l’accueil' })).toBeVisible();
});

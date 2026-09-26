import { expect, test } from '@playwright/test';
import { admin, CW8, login, resetData } from './support';

const GUEST_EMAIL = 'invite@bourse.local';

test("invitation : l'administrateur crée un lien, l'invité s'inscrit et ne voit rien des autres", async ({
  page,
  browser,
}) => {
  const { userId } = await resetData();
  await admin.from('profiles').update({ is_admin: true }).eq('user_id', userId);
  const old = (await admin.auth.admin.listUsers()).data.users.find((u) => u.email === GUEST_EMAIL);
  if (old) await admin.auth.admin.deleteUser(old.id);
  await admin.from('invitations').delete().not('id', 'is', null);

  await login(page);
  await page.getByRole('link', { name: 'Invitations' }).click();
  await page.getByLabel('Pour qui ? (facultatif)').fill('Camille');
  await page.getByRole('button', { name: 'Créer un lien d’invitation' }).click();
  await expect(page.getByText('En attente')).toBeVisible();
  const url = await page.getByLabel('Lien').inputValue();
  expect(url).toMatch(/\/signup\?code=[0-9a-f]{32}$/);

  // l'invité, dans un autre navigateur (sans session)
  const guest = await browser.newPage();
  await guest.goto(new URL(url).pathname + new URL(url).search);
  await guest.getByPlaceholder('Email').fill(GUEST_EMAIL);
  await guest.getByPlaceholder(/Mot de passe/).fill('invite-password-123');
  await guest.getByRole('button', { name: 'Créer mon compte' }).click();
  await guest.waitForURL('/');

  // pas de menu d'administration, et aucun titre de l'administrateur
  await expect(guest.getByRole('link', { name: 'Invitations' })).toHaveCount(0);
  await guest.goto('/orders');
  await expect(guest.getByRole('option', { name: new RegExp(CW8.name) })).toHaveCount(0);
  expect((await guest.goto('/invitations'))?.status()).toBe(404);

  // le lien ne sert qu'une fois
  const again = await browser.newPage();
  await again.goto(new URL(url).pathname + new URL(url).search);
  await expect(again.locator('p[role="alert"]')).toContainText('invalide, expiré ou déjà utilisé');

  await page.reload();
  await expect(page.getByText(`Utilisée par ${GUEST_EMAIL}`)).toBeVisible();
});

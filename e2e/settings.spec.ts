import { expect, test } from '@playwright/test';
import { admin, login, resetData } from './support';

test('réglages : enregistrement, validation, persistance et tests non configurés', async ({
  page,
}) => {
  await resetData();
  await login(page);
  await page.goto('/settings');

  // valeurs par défaut
  await expect(page.getByLabel('Recevoir un résumé')).toBeChecked();
  await expect(page.getByLabel('À partir de')).toHaveValue('17:45');

  // sans réglages enregistrés : les tests indiquent « non configuré »
  await page.getByRole('button', { name: 'Envoyer un test Discord' }).click();
  await expect(page.getByText('Discord : non configuré')).toBeVisible();

  // validation : un webhook qui n'est pas Discord est refusé
  await page.getByLabel('Webhook Discord').fill('https://evil.example.com/api/webhooks/1/x');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Webhook Discord invalide');
  // la saisie est conservée après l'erreur (et React a fini de réinitialiser le formulaire)
  await expect(page.getByLabel('Webhook Discord')).toHaveValue(
    'https://evil.example.com/api/webhooks/1/x',
  );

  // (email et heure invalides sont bloqués par le navigateur ; la validation serveur
  // correspondante est couverte par les tests unitaires de lib/settings)

  // enregistrement valide
  await page.getByLabel('Webhook Discord').fill('https://discord.com/api/webhooks/123/abc');
  await page.getByLabel('Adresse email').fill('moi@example.com');
  await page.getByLabel('À partir de').fill('18:10');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Réglages enregistrés.')).toBeVisible();

  const row = await admin.from('settings').select('*').single();
  expect(row.data).toMatchObject({
    discord_webhook_url: 'https://discord.com/api/webhooks/123/abc',
    email: 'moi@example.com',
    summary_enabled: true,
    summary_time: '18:10:00',
  });

  // persistance après rechargement
  await page.reload();
  await expect(page.getByLabel('Webhook Discord')).toHaveValue(
    'https://discord.com/api/webhooks/123/abc',
  );
  await expect(page.getByLabel('À partir de')).toHaveValue('18:10');

  // désactivation du résumé
  await page.getByLabel('Recevoir un résumé').uncheck();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Réglages enregistrés.')).toBeVisible();
  expect(
    (await admin.from('settings').select('summary_enabled').single()).data?.summary_enabled,
  ).toBe(false);

  // l'email n'est pas configuré côté serveur (pas de clé Resend en test) : échec explicite
  await page.getByRole('button', { name: 'Envoyer un test email' }).click();
  await expect(page.getByText(/Email : non configuré/)).toBeVisible();
});

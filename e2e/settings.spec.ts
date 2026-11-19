import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
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
  await page.getByLabel(/Indice de référence/).fill('^FCHI');
  await page.getByLabel('Rapport périodique').selectOption('monthly');
  await page.getByLabel(/Sujet ntfy/).fill('https://ntfy.sh/bourse-e2e');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Réglages enregistrés.')).toBeVisible();

  const row = await admin.from('settings').select('*').single();
  expect(row.data).toMatchObject({
    discord_webhook_url: 'https://discord.com/api/webhooks/123/abc',
    email: 'moi@example.com',
    summary_enabled: true,
    summary_time: '18:10:00',
    benchmark_symbol: '^FCHI',
    report_frequency: 'monthly',
    ntfy_url: 'https://ntfy.sh/bourse-e2e',
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

test('adresse email de notification : confirmation par code, tests limités', async ({ page }) => {
  const { userId } = await resetData();
  await login(page);
  await page.goto('/settings');

  // une autre adresse que celle du compte : à confirmer
  await page.getByLabel('Adresse email').fill('tiers@example.com');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Réglages enregistrés.')).toBeVisible();
  await page.reload();
  const box = page.getByRole('region', { name: 'Confirmation de l’adresse email' });
  await expect(box).toContainText('pas encore confirmée');
  expect((await admin.from('settings').select('email_verified').single()).data).toEqual({
    email_verified: false,
  });

  await box.getByRole('button', { name: 'Recevoir un code de confirmation' }).click();
  await expect(box.getByRole('status')).toContainText('Code demandé');

  // le worker envoie le code (simulé : seule son empreinte est en base)
  await admin
    .from('notification_email_verifications')
    .update({
      code_hash: createHash('sha256').update('123456').digest('hex'),
      code_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      requested_at: null,
      sent_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  await box.getByLabel('Code reçu').fill('654321');
  await box.getByRole('button', { name: 'Confirmer' }).click();
  await expect(box.getByRole('alert')).toContainText('Code incorrect');
  await box.getByLabel('Code reçu').fill('123456');
  await box.getByRole('button', { name: 'Confirmer' }).click();
  await expect(box).toContainText('adresse confirmée');
  expect((await admin.from('settings').select('email_verified').single()).data).toEqual({
    email_verified: true,
  });

  // messages de test : un par canal et par minute
  await page.getByRole('button', { name: 'Envoyer un test Discord' }).click();
  await expect(page.getByText('Discord : non configuré')).toBeVisible();
  await page.getByRole('button', { name: 'Envoyer un test Discord' }).click();
  await expect(page.getByText(/réessaie dans une minute/)).toBeVisible();
});

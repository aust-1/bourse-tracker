import { expect, test } from '@playwright/test';
import { admin, login, mockInstrumentSearch, resetData } from './support';

test('alertes : création, condition déjà vraie, pause, ré-armement, suppression, historique', async ({
  page,
}) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('quotes_latest').upsert({
    instrument_id: instrumentId,
    price: 110,
    prev_close: 108,
    quoted_at: new Date().toISOString(),
  });
  await mockInstrumentSearch(page);
  await login(page);

  // alerte de prix dont la condition est déjà vraie (cours 110 ≥ 105)
  await page.goto('/alerts/new');
  await page.getByLabel('Instrument').fill('amundi msci');
  await page.getByRole('button', { name: /Amundi MSCI World Swap/ }).click();
  await page.getByLabel('Condition').selectOption('price_above');
  await page.getByLabel(/Seuil/).fill('105,5');
  await page.getByRole('button', { name: "Créer l'alerte" }).click();

  await expect(page).toHaveURL(/\/alerts\?notice=already_true/);
  await expect(page.getByRole('status')).toContainText('déjà remplie');
  const row = page.getByRole('row', { name: /Amundi MSCI World Swap/ });
  await expect(row).toContainText('cours ≥');
  await expect(row).toContainText('Active');

  // alerte de baisse du jour : l'utilisateur saisit 5, la base stocke -5
  await page.goto('/alerts/new');
  await page.getByLabel('Instrument').fill('amundi msci');
  await page.getByRole('button', { name: /Amundi MSCI World Swap/ }).click();
  await page.getByLabel('Condition').selectOption('day_change_down');
  await page.getByLabel(/Seuil/).fill('5');
  await page.getByRole('button', { name: "Créer l'alerte" }).click();
  await expect(page).toHaveURL(/\/alerts$/);
  const stored = await admin
    .from('alerts')
    .select('threshold')
    .eq('type', 'day_change_down')
    .single();
  expect(stored.data?.threshold).toBe(-5);

  // validation : seuil invalide
  await page.goto('/alerts/new');
  await page.getByLabel('Instrument').fill('amundi msci');
  await page.getByRole('button', { name: /Amundi MSCI World Swap/ }).click();
  await page.getByLabel(/Seuil/).fill('0');
  await page.getByRole('button', { name: "Créer l'alerte" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Seuil');

  // pause puis reprise de l'alerte de prix
  await page.goto('/alerts');
  const priceRow = page.getByRole('row', { name: /cours ≥/ });
  await priceRow.getByRole('button', { name: 'Pause' }).click();
  await expect(priceRow).toContainText('En pause');
  await priceRow.getByRole('button', { name: 'Reprendre' }).click();
  await expect(priceRow).toContainText('Active');

  // simule le déclenchement par le worker : statut, événement d'historique
  const alert = await admin.from('alerts').select('id').eq('type', 'price_above').single();
  await admin
    .from('alerts')
    .update({ status: 'triggered', last_triggered_at: new Date().toISOString() })
    .eq('id', alert.data!.id);
  await admin.from('alert_events').insert({
    alert_id: alert.data!.id,
    user_id: userId,
    value_at_trigger: 110,
    delivery: { discord: 'sent', email: 'error: Resend HTTP 500' },
  });

  await page.goto('/alerts');
  await expect(page.getByRole('row', { name: /cours ≥/ })).toContainText('Déclenchée');
  await expect(page.getByText('Discord : envoyé')).toBeVisible();
  await expect(page.getByText('Email : échec (Resend HTTP 500)')).toBeVisible();

  // ré-armement
  await page
    .getByRole('row', { name: /cours ≥/ })
    .getByRole('button', { name: 'Ré-armer' })
    .click();
  await expect(page.getByRole('row', { name: /cours ≥/ })).toContainText('Active');

  // suppression
  await page
    .getByRole('row', { name: /cours ≥/ })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(page.getByRole('row', { name: /cours ≥/ })).toHaveCount(0);
});

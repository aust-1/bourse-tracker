import { expect, test } from '@playwright/test';
import { admin, login, mockInstrumentSearch, resetData } from './support';

test('liste de suivi : ajout sans ordre, cours, alerte, retrait', async ({ page }) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('user_instruments').update({ watched: false }).eq('user_id', userId);
  await admin.from('quotes_latest').upsert({
    instrument_id: instrumentId,
    price: 110,
    prev_close: 100,
    quoted_at: new Date().toISOString(),
  });
  await mockInstrumentSearch(page);
  await login(page);

  await page.getByRole('link', { name: /suivi/ }).click();
  await page.waitForURL('**/watchlist');
  await expect(page.getByText('Aucun titre suivi')).toBeVisible();

  await page.getByLabel('Instrument').fill('amundi msci');
  await page.getByRole('button', { name: /Amundi MSCI World Swap/ }).click();
  await page.getByRole('button', { name: 'Suivre ce titre' }).click();
  const row = page.getByRole('row', { name: /Amundi MSCI World Swap/ });
  await expect(row).toContainText('110,00');
  await expect(row).toContainText('+10,00 %');
  expect(
    (await admin.from('user_instruments').select('watched').eq('user_id', userId).single()).data,
  ).toEqual({ watched: true });

  // raccourci vers une alerte sur ce titre
  await row.getByRole('link', { name: 'Créer une alerte' }).click();
  await expect(page.getByLabel('Instrument')).toHaveValue(/Amundi MSCI World Swap/);

  // la fiche du titre indique le suivi et permet de le retirer
  await page.goto(`/instruments/${instrumentId}`);
  await page.getByRole('button', { name: /Suivi \(retirer de la liste\)/ }).click();
  await expect(page.getByRole('button', { name: '☆ Suivre ce titre' })).toBeVisible();
  await page.goto('/watchlist');
  await expect(page.getByText('Aucun titre suivi')).toBeVisible();
});

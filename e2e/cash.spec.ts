import { expect, test } from '@playwright/test';
import { admin, CW8, login, resetData } from './support';

test('mouvements : versement, dividende, liquidités et plafond du PEA', async ({ page }) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'buy',
    quantity: 10,
    unit_price: 100,
    fees: 2,
    executed_at: '2026-01-05T09:30:00Z',
  });
  await login(page);
  await page.getByRole('link', { name: /mouvements/ }).click();
  await page.waitForURL('**/cash');

  // sans versement : le solde est négatif (achats seuls)
  await expect(page.getByTestId('cash-balance')).toContainText('-1 002,00');

  await page.getByLabel('Montant net (€)').fill('5 000');
  await page.getByLabel('Date', { exact: true }).fill('2026-01-02');
  await page.getByRole('button', { name: 'Ajouter le mouvement' }).click();
  await expect(page.getByText('Mouvement enregistré.')).toBeVisible();
  await expect(page.getByTestId('cash-balance')).toContainText('3 998,00');
  await expect(page.getByRole('meter', { name: 'PEA' })).toHaveAttribute('aria-valuenow', '5000');
  await expect(page.getByText('Reste 145 000,00 € de versements possibles')).toBeVisible();

  // dividende : le titre est obligatoire
  await page.getByLabel('Type').selectOption('dividend');
  await page.getByLabel('Montant net (€)').fill('12,50');
  await page.getByLabel('Titre').selectOption({ label: `${CW8.name} (${CW8.yahoo_symbol})` });
  await page.getByRole('button', { name: 'Ajouter le mouvement' }).click();
  await expect(page.getByTestId('cash-balance')).toContainText('4 010,50');
  await expect(page.getByRole('row', { name: /Dividende/ })).toContainText(CW8.name);

  // tableau de bord : liquidités et valeur totale
  await page.goto('/');
  await expect(page.getByRole('paragraph').filter({ hasText: /^Liquidités$/ })).toBeVisible();
  await expect(page.getByText('Valeur totale')).toBeVisible();
  await expect(page.getByText('Versements cumulés')).toBeVisible();
  await expect(page.getByText('Dividendes reçus')).toBeVisible();
  await page.getByRole('link', { name: CW8.name }).click();
  await expect(page.getByTestId('instrument-dividends')).toContainText('12,50');

  // suppression d'un mouvement
  await page.goto('/cash');
  await page
    .getByRole('row', { name: /Dividende/ })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(page.getByTestId('cash-balance')).toContainText('3 998,00');
});

import { expect, test } from '@playwright/test';
import { admin, login, mockInstrumentSearch, resetData } from './support';

test('portefeuilles : création, ordre rattaché, vente contrôlée par portefeuille, filtre', async ({
  page,
}) => {
  const { userId, instrumentId } = await resetData();
  await mockInstrumentSearch(page);
  // 10 titres achetés sur le PEA
  await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'buy',
    quantity: 10,
    unit_price: 100,
    executed_at: '2026-01-05T09:30:00Z',
  });
  await login(page);

  // un seul portefeuille : pas de sélecteur
  await expect(page.getByLabel('Portefeuille affiché')).toHaveCount(0);

  await page.getByRole('link', { name: /portefeuilles/ }).click();
  await page.waitForURL('**/portfolios');
  await page.getByLabel('Nom').fill('Mon CTO');
  await page.getByLabel('Type').selectOption('cto');
  await page.getByRole('button', { name: 'Créer le portefeuille' }).click();
  await expect(page.getByRole('row', { name: /Mon CTO/ })).toContainText('Compte-titres');

  // vente sur le CTO de titres détenus sur le PEA : refusée
  await page.goto('/orders/new');
  await page.locator('select[name="portfolioId"]').selectOption({ label: 'Mon CTO' });
  await page.getByLabel('Instrument').fill('amundi msci');
  await page.getByRole('button', { name: /Amundi MSCI World Swap/ }).click();
  await page.getByLabel('Vente').check();
  await page.getByLabel('Quantité').fill('2');
  await page.getByLabel('Prix unitaire (€)').fill('110');
  await page.getByLabel(/Date et heure/).fill('2026-01-06T10:00');
  await page.getByRole('button', { name: "Ajouter l'ordre" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Vente impossible');

  // achat sur le CTO
  await page.getByLabel('Achat').check();
  await page.getByRole('button', { name: "Ajouter l'ordre" }).click();
  await page.waitForURL('**/orders');
  await expect(page.getByRole('columnheader', { name: 'Portefeuille' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Mon CTO/ })).toHaveCount(1);

  // filtre sur le CTO : un seul ordre
  await page.getByLabel('Portefeuille affiché').selectOption({ label: 'Mon CTO' });
  await expect(page.getByRole('row', { name: /Amundi MSCI World Swap/ })).toHaveCount(1);
  await expect(page.getByRole('columnheader', { name: 'Portefeuille' })).toHaveCount(0);

  // retour à l'ensemble
  await page.getByLabel('Portefeuille affiché').selectOption('all');
  await expect(page.getByRole('row', { name: /Amundi MSCI World Swap/ })).toHaveCount(2);

  // un portefeuille avec des ordres ne peut pas être supprimé
  await page.goto('/portfolios');
  await expect(
    page.getByRole('row', { name: /Mon CTO/ }).getByRole('button', { name: 'Supprimer' }),
  ).toHaveCount(0);
});

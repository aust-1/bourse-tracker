import { expect, test } from '@playwright/test';
import { admin, CW8, login, resetData } from './support';

const header = 'date;symbole;nom;sens;quantite;prix_unitaire;frais;note;portefeuille';

test('import CSV : aperçu (doublon, erreur), import, puis refus global en cas de découvert', async ({
  page,
}) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'buy',
    quantity: 10,
    unit_price: 100,
    executed_at: '2026-01-05T09:30:00Z',
  });
  await login(page);
  await page.goto('/orders');
  await page.getByRole('link', { name: 'Import CSV' }).click();
  await page.waitForURL('**/orders/import');

  const csv = [
    header,
    `2026-01-05T09:30:00.000Z;${CW8.yahoo_symbol};World;achat;10;100;0;;`,
    `06/01/2026 10:00;${CW8.yahoo_symbol};World;Vente;4;110,5;1,5;prise de bénéfices;`,
    `07/01/2026;${CW8.yahoo_symbol};World;Dividende;1;1;0;;`,
  ].join('\n');
  await page.getByLabel('ou colle son contenu').fill(csv);
  await page.getByRole('button', { name: 'Aperçu' }).click();

  const table = page.getByRole('table', { name: 'Aperçu de l’import' });
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table.getByRole('row', { name: /^2 / })).toContainText('Doublon');
  await expect(table.getByRole('row', { name: /^3 / })).toContainText('À importer');
  await expect(table.getByRole('row', { name: /^4 / })).toContainText('sens inconnu');

  await page.getByRole('button', { name: 'Importer 1 ordre' }).click();
  await page.waitForURL('**/orders?imported=1');
  await expect(page.getByRole('status')).toContainText('1 ordre importé');
  await expect(page.getByTestId('orders-totals')).toContainText('2 ordres');

  // une vente plus grande que la position : rien n'est importé
  await page.goto('/orders/import');
  await page
    .getByLabel('ou colle son contenu')
    .fill(
      [
        header,
        `08/01/2026;${CW8.yahoo_symbol};;achat;1;100;0;;`,
        `09/01/2026;${CW8.yahoo_symbol};;vente;50;100;0;;`,
      ].join('\n'),
    );
  await page.getByRole('button', { name: 'Aperçu' }).click();
  await page.getByRole('button', { name: 'Importer 2 ordres' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("Rien n'a été importé");
  const count = await admin.from('orders').select('id', { count: 'exact', head: true });
  expect(count.count).toBe(2);
});

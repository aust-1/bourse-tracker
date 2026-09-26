import { expect, test, type Page } from '@playwright/test';
import { login, mockInstrumentSearch, resetData } from './support';

test.beforeEach(async ({ page }) => {
  await resetData();
  await mockInstrumentSearch(page);
});

async function fillOrder(
  page: Page,
  o: { side: 'Achat' | 'Vente'; qty: string; price: string; fees?: string; when: string },
) {
  await page.goto('/orders/new');
  await page.getByLabel('Instrument').fill('amundi msci');
  await page.getByRole('button', { name: /Amundi MSCI World Swap/ }).click();
  await page.getByLabel(o.side).check();
  await page.getByLabel('Quantité').fill(o.qty);
  await page.getByLabel('Prix unitaire (€)').fill(o.price);
  if (o.fees) await page.getByLabel('Frais (€)').fill(o.fees);
  await page.getByLabel(/Date et heure/).fill(o.when);
  await page.getByRole('button', { name: "Ajouter l'ordre" }).click();
}

test('accès protégé : redirection vers la connexion', async ({ page }) => {
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login/);
});

test("mauvais mot de passe : message d'erreur", async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('e2e@bourse.local');
  await page.getByPlaceholder('Mot de passe').fill('faux');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Identifiants incorrects');
});

test("cycle de vie d'un ordre : ajout, vente à découvert refusée, modification, suppression, export", async ({
  page,
}) => {
  await login(page);

  await fillOrder(page, {
    side: 'Achat',
    qty: '10',
    price: '100,50',
    fees: '1,25',
    when: '2026-01-05T10:30',
  });
  await expect(page).toHaveURL(/\/orders$/);
  const row = page.getByRole('row', { name: /Amundi MSCI World Swap/ });
  await expect(row).toContainText('Achat');
  await expect(row).toContainText('10');

  // vente supérieure à la quantité détenue : refusée par la base
  await fillOrder(page, { side: 'Vente', qty: '11', price: '110', when: '2026-01-06T10:00' });
  await expect(page.locator('p[role="alert"]')).toContainText('négative');

  // vente valide
  await fillOrder(page, { side: 'Vente', qty: '4', price: '110', when: '2026-01-06T10:00' });
  await expect(page.getByRole('row', { name: /Vente/ })).toBeVisible();

  // le filtre par sens fonctionne
  await page.goto('/orders?side=sell');
  await expect(page.getByRole('row', { name: /Achat/ })).toHaveCount(0);
  await expect(page.getByRole('row', { name: /Vente/ })).toHaveCount(1);

  // export CSV
  const download = page.waitForEvent('download');
  await page.goto('/orders');
  await page.getByRole('link', { name: 'Export CSV' }).click();
  const csv = await (await (await download).createReadStream()).toArray();
  const text = Buffer.concat(csv).toString('utf8');
  expect(text).toContain('CW8.PA');
  expect(text).toContain(';achat;10;100.5;1.25;');
  expect(text).toContain(';vente;4;110;0;');

  // modification de la vente
  await page.getByRole('row', { name: /Vente/ }).getByRole('link', { name: 'Modifier' }).click();
  await page.getByLabel('Quantité').fill('5');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('row', { name: /Vente/ })).toContainText('5');

  // supprimer l'achat couvrant la vente est refusé
  await page.getByRole('row', { name: /Achat/ }).getByRole('link', { name: 'Modifier' }).click();
  await page.getByRole('button', { name: 'Supprimer cet ordre' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('négative');

  // suppression de la vente puis de l'achat
  await page.goto('/orders');
  await page.getByRole('row', { name: /Vente/ }).getByRole('link', { name: 'Modifier' }).click();
  await page.getByRole('button', { name: 'Supprimer cet ordre' }).click();
  await page.getByRole('row', { name: /Achat/ }).getByRole('link', { name: 'Modifier' }).click();
  await page.getByRole('button', { name: 'Supprimer cet ordre' }).click();
  await expect(page.getByText('Aucun ordre')).toBeVisible();
});

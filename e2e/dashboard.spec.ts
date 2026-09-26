import { expect, test } from '@playwright/test';
import { admin, CW8, login, resetData } from './support';

test('tableau de bord : valeur, gains, et mise à jour en direct sans rechargement', async ({
  page,
}) => {
  const { userId, instrumentId } = await resetData();
  const orders = await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'buy',
    quantity: 10,
    unit_price: 100,
    fees: 0,
    executed_at: '2026-01-05T10:00:00Z',
  });
  expect(orders.error).toBeNull();

  const quote = (price: number) => ({
    instrument_id: instrumentId,
    price,
    prev_close: 108,
    quoted_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
  });
  expect((await admin.from('quotes_latest').upsert(quote(110))).error).toBeNull();

  await login(page);
  await expect(page.getByText(CW8.name)).toBeVisible();
  const totalCard = page.locator('.card', { hasText: 'Valeur du portefeuille' });
  await expect(totalCard).toContainText(/1\s100,00\s€/);
  const latent = page.locator('.card', { hasText: 'Gain latent' });
  await expect(latent).toContainText(/\+100,00\s€/);
  await expect(latent).toContainText('▲');

  // le canal temps réel doit être établi (sinon seul le filet de 15 s agirait)
  await expect(page.getByText('Connexion temps réel active')).toBeVisible({ timeout: 10_000 });

  // le worker met la cote à jour : l'écran suit sans recharger la page
  // (délai < 5 s : seul le temps réel peut répondre aussi vite, le filet est à 15 s)
  expect((await admin.from('quotes_latest').upsert(quote(120))).error).toBeNull();
  await expect(totalCard).toContainText(/1\s200,00\s€/, { timeout: 5_000 });
  await expect(latent).toContainText(/\+200,00\s€/);

  // baisse : signe et flèche
  expect((await admin.from('quotes_latest').upsert(quote(90))).error).toBeNull();
  await expect(latent).toContainText(/-100,00\s€/, { timeout: 5_000 });
  await expect(latent).toContainText('▼');
});

test('tableau de bord vide : invitation à saisir un premier ordre', async ({ page }) => {
  await resetData();
  await login(page);
  await expect(page.getByRole('link', { name: 'Ajoute ton premier ordre' })).toBeVisible();
});

test('fiche instrument : graphique, position et ordres', async ({ page }) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'buy',
    quantity: 3,
    unit_price: 100,
    executed_at: '2026-01-05T10:00:00Z',
  });
  await admin.from('quotes_latest').upsert({
    instrument_id: instrumentId,
    price: 110,
    prev_close: 100,
    quoted_at: new Date().toISOString(),
  });
  const base = Date.parse('2026-09-25T07:00:00Z');
  await page.route('**/api/instruments/*/series*', (route) =>
    route.fulfill({
      json: {
        points: Array.from({ length: 30 }, (_, i) => ({ t: base + i * 300_000, v: 100 + i })),
      },
    }),
  );

  await login(page);
  await page.goto(`/instruments/${instrumentId}`);
  await expect(page.getByRole('heading', { name: CW8.name })).toBeVisible();
  await expect(page.locator('figure')).toBeVisible();
  await expect(page.getByText('Voir les données en tableau')).toBeVisible();
  await expect(page.getByText('Ma position')).toBeVisible();
  await expect(page.locator('section', { hasText: 'Ma position' })).toContainText(/\+30,00\s€/);

  // changer de période recharge la série
  await page.getByRole('tab', { name: '1 M' }).click();
  await expect(page.getByRole('tab', { name: '1 M' })).toHaveAttribute('aria-selected', 'true');
});

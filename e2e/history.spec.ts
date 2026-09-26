import { expect, test } from '@playwright/test';
import { admin, login, resetData } from './support';

const dayOffset = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

test('historique : courbe, gain hors apports et changement de période', async ({ page }) => {
  const { userId, instrumentId } = await resetData();

  // 45 jours de clôtures (100 → 144 hier) ; achat de 10 titres à 100 il y a 45 jours
  const closes = Array.from({ length: 45 }, (_, i) => ({
    instrument_id: instrumentId,
    date: dayOffset(45 - i),
    close: 100 + i,
  }));
  expect((await admin.from('price_history').insert(closes)).error).toBeNull();
  expect(
    (
      await admin.from('orders').insert({
        user_id: userId,
        instrument_id: instrumentId,
        side: 'buy',
        quantity: 10,
        unit_price: 100,
        executed_at: `${dayOffset(45)}T10:00:00Z`,
      })
    ).error,
  ).toBeNull();

  await login(page);
  await page.goto('/history?range=all');
  await expect(page.locator('figure')).toBeVisible();
  await expect(page.getByText('Valeur du portefeuille').first()).toBeVisible();
  const gain = page.locator('.card', { hasText: 'Gain sur la période' });
  await expect(gain).toContainText(/\+440,00\s€/);
  const rendement = page.locator('.card', { hasText: 'Rendement' });
  await expect(rendement).toContainText(/\+44,00\s%/);
  await expect(page.locator('.card', { hasText: 'Apports nets' })).toContainText(/1\s000,00\s€/);

  // 1 mois : l'achat est antérieur à la période, donc aucun apport
  await page.getByRole('link', { name: '1 M' }).click();
  await expect(page).toHaveURL(/range=1m/);
  await expect(page.locator('.card', { hasText: 'Apports nets' })).toContainText(/0,00\s€/);
  await expect(page.locator('.card', { hasText: 'Gain sur la période' })).toContainText('▲');

  // la mini-courbe du tableau de bord
  await page.goto('/');
  await expect(page.getByRole('img', { name: /30 dernières séances/ })).toBeVisible();
});

test('historique sans ordre', async ({ page }) => {
  await resetData();
  await login(page);
  await page.goto('/history');
  await expect(page.getByText('Aucun ordre')).toBeVisible();
});

test('historique en cours de chargement : le worker n’a pas encore rempli les clôtures', async ({
  page,
}) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'buy',
    quantity: 1,
    unit_price: 100,
    executed_at: `${dayOffset(10)}T10:00:00Z`,
  });
  await login(page);
  await page.goto('/history');
  await expect(page.getByRole('status')).toContainText('Historique en cours de chargement');
});

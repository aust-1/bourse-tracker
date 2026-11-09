import { expect, test } from '@playwright/test';
import { admin, login, resetData } from './support';

test("division saisie par l'administrateur : position convertie, vente des nouveaux titres possible", async ({
  page,
}) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('profiles').update({ is_admin: true }).eq('user_id', userId);
  await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'buy',
    quantity: 10,
    unit_price: 500,
    executed_at: '2026-05-04T08:00:00Z',
  });
  await login(page);
  await page.goto(`/instruments/${instrumentId}`);
  const position = page.locator('section', {
    has: page.getByRole('heading', { name: 'Ma position' }),
  });
  await expect(position.getByText('500,00 €')).toBeVisible(); // PRU avant division

  const splits = page.getByRole('region', { name: 'Divisions' });
  await splits.getByLabel('Date d’effet').fill('2026-06-01');
  await splits.getByLabel('Nouveaux titres').fill('10');
  await splits.getByRole('button', { name: 'Ajouter la division' }).click();
  await expect(splits.getByText('1 ancien → 10 nouveaux')).toBeVisible();
  await expect(position.getByText('50,00 €')).toBeVisible(); // PRU sur la nouvelle base

  // vente de 50 titres « nouveaux » acceptée par la base
  const sell = await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'sell',
    quantity: 50,
    unit_price: 55,
    executed_at: '2026-06-02T08:00:00Z',
  });
  expect(sell.error).toBeNull();

  // un compte non administrateur ne voit pas le formulaire
  await admin.from('profiles').update({ is_admin: false }).eq('user_id', userId);
  await page.reload();
  await expect(splits.getByRole('button', { name: 'Ajouter la division' })).toHaveCount(0);
  await expect(splits.getByText('1 ancien → 10 nouveaux')).toBeVisible();
});

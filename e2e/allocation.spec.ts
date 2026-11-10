import { expect, test } from '@playwright/test';
import { admin, login, resetData } from './support';

test('répartition par ligne et par type, liquidités comprises', async ({ page }) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('instruments').update({ asset_type: 'etf' }).eq('id', instrumentId);
  const second = await admin
    .from('instruments')
    .insert({ yahoo_symbol: 'MC.PA', name: 'LVMH', exchange: 'PAR', asset_type: 'equity' })
    .select('id')
    .single();
  await admin.from('user_instruments').insert({ user_id: userId, instrument_id: second.data!.id });
  const pea = await admin.from('portfolios').select('id').eq('user_id', userId).single();
  await admin.from('orders').insert([
    {
      user_id: userId,
      instrument_id: instrumentId,
      side: 'buy',
      quantity: 6,
      unit_price: 100,
      executed_at: '2026-01-05T09:30:00Z',
    },
    {
      user_id: userId,
      instrument_id: second.data!.id,
      side: 'buy',
      quantity: 2,
      unit_price: 100,
      executed_at: '2026-01-05T09:30:00Z',
    },
  ]);
  await admin.from('quotes_latest').insert([
    { instrument_id: instrumentId, price: 100, prev_close: 100, quoted_at: '2026-01-06T16:30:00Z' },
    {
      instrument_id: second.data!.id,
      price: 100,
      prev_close: 100,
      quoted_at: '2026-01-06T16:30:00Z',
    },
  ]);
  // 1 000 € versés, 800 € investis : 200 € de liquidités
  await admin.from('cash_movements').insert({
    user_id: userId,
    portfolio_id: pea.data!.id,
    kind: 'deposit',
    amount: 1000,
    occurred_on: '2026-01-02',
  });
  await login(page);

  const byLine = page.getByRole('list', { name: 'Par ligne' });
  await expect(byLine.getByRole('listitem')).toHaveCount(3);
  await expect(byLine.getByRole('listitem').first()).toContainText('60 %');
  const byType = page.getByRole('list', { name: 'Par type d’actif' });
  await expect(byType).toContainText('ETF');
  await expect(byType).toContainText('Actions');
  await expect(byType).toContainText('Liquidités');
  await page
    .getByRole('region', { name: 'Répartition' })
    .screenshot({ path: 'test-results/allocation.png' });
});

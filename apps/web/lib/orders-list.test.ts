import { describe, expect, it } from 'vitest';
import { dateBounds, netAmount, pageHref, parseFilters, selectionTotals } from './orders-list';

describe('netAmount / selectionTotals', () => {
  const buy = { side: 'buy' as const, quantity: 10, unit_price: 100, fees: 2 };
  const sell = { side: 'sell' as const, quantity: 4, unit_price: 120, fees: 1 };
  it('achat frais compris, vente nette de frais', () => {
    expect(netAmount(buy)).toBe(1002);
    expect(netAmount(sell)).toBe(479);
  });
  it('totaux de la sélection', () => {
    expect(selectionTotals([buy, sell, buy])).toEqual({
      count: 3,
      bought: 2004,
      sold: 479,
      fees: 5,
    });
  });
});

describe('parseFilters', () => {
  it('valeurs valides', () => {
    expect(
      parseFilters({
        instrument: 'abc',
        side: 'sell',
        from: '2026-01-01',
        to: '2026-02-01',
        page: '3',
      }),
    ).toEqual({ instrument: 'abc', side: 'sell', from: '2026-01-01', to: '2026-02-01', page: 3 });
  });
  it('valeurs invalides ignorées', () => {
    expect(parseFilters({ side: 'x', from: '01/01/2026', page: '-2' })).toEqual({
      instrument: null,
      side: null,
      from: null,
      to: null,
      page: 1,
    });
  });
});

describe('dateBounds', () => {
  it('jours de Paris, borne de fin incluse', () => {
    expect(dateBounds({ from: '2026-01-05', to: '2026-01-05' })).toEqual({
      gte: '2026-01-04T23:00:00.000Z',
      lt: '2026-01-05T23:00:00.000Z',
    });
  });
});

describe('pageHref', () => {
  it('garde les filtres', () => {
    const f = parseFilters({ side: 'buy', from: '2026-01-01' });
    expect(pageHref(f, 2)).toBe('/orders?side=buy&from=2026-01-01&page=2');
    expect(pageHref(parseFilters({}), 1)).toBe('/orders');
  });
});

import { describe, expect, it } from 'vitest';
import { buildHistory, incomeFlows, periodStats, rangeStart } from './history';
import type { OrderRow, QuoteRow } from '@bourse/core';

const order = (
  id: string,
  side: 'buy' | 'sell',
  quantity: number,
  unitPrice: number,
  executedAt: string,
  fees = 0,
): OrderRow => ({ id, instrumentId: 'a', side, quantity, unitPrice, fees, executedAt });

const closes = [
  ['2026-08-24', 100],
  ['2026-08-25', 102],
  ['2026-09-01', 104],
  ['2026-09-15', 110],
  ['2026-09-24', 120],
].map(([date, close]) => ({ instrumentId: 'a', date: date as string, close: close as number }));

describe('buildHistory', () => {
  const orders = [order('1', 'buy', 10, 100, '2026-08-24T08:00:00Z')];

  it('une valeur par séance depuis le premier ordre', () => {
    const h = buildHistory(orders, closes, []);
    expect(h.map((s) => s.date)).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-09-01',
      '2026-09-15',
      '2026-09-24',
    ]);
    expect(h[0]).toMatchObject({ marketValue: 1000, netContributions: 1000 });
    expect(h[4]).toMatchObject({ marketValue: 1200 });
  });

  it('ignore les séances antérieures au premier ordre', () => {
    const late = [order('1', 'buy', 10, 100, '2026-09-01T08:00:00Z')];
    expect(buildHistory(late, closes, [])[0]!.date).toBe('2026-09-01');
  });

  it('ajoute la cote en direct pour la séance sans clôture enregistrée', () => {
    const quote: QuoteRow = {
      instrumentId: 'a',
      price: 125,
      prevClose: 120,
      quotedAt: '2026-09-25T10:00:00Z',
      fetchedAt: '2026-09-25T10:00:30Z',
    };
    const h = buildHistory(orders, closes, [quote]);
    expect(h[h.length - 1]).toMatchObject({ date: '2026-09-25', marketValue: 1250 });
  });

  it('garde la clôture enregistrée si elle existe déjà pour ce jour', () => {
    const quote: QuoteRow = {
      instrumentId: 'a',
      price: 999,
      prevClose: 120,
      quotedAt: '2026-09-24T15:35:00Z',
      fetchedAt: '2026-09-24T15:36:00Z',
    };
    const h = buildHistory(orders, closes, [quote]);
    expect(h[h.length - 1]).toMatchObject({ date: '2026-09-24', marketValue: 1200 });
  });

  it('aucun ordre : courbe vide', () => {
    expect(buildHistory([], closes, [])).toEqual([]);
  });
});

describe('rangeStart', () => {
  it('bornes de période', () => {
    expect(rangeStart('1m', '2026-09-26')).toBe('2026-08-26');
    expect(rangeStart('3m', '2026-09-26')).toBe('2026-06-26');
    expect(rangeStart('1y', '2026-09-26')).toBe('2025-09-26');
    expect(rangeStart('ytd', '2026-09-26')).toBe('2026-01-01');
    expect(rangeStart('all', '2026-09-26')).toBeNull();
  });
});

describe('periodStats', () => {
  it('gain hors apports : un achat pendant la période ne compte pas comme performance', () => {
    const orders = [
      order('1', 'buy', 10, 100, '2026-08-24T08:00:00Z'), // 1000
      order('2', 'buy', 10, 110, '2026-09-15T08:00:00Z'), // +1100 d'apports
    ];
    const snaps = buildHistory(orders, closes, []);
    const s = periodStats(snaps, '1m', '2026-09-26')!;
    // base = clôture du 25/08 (10 × 102 = 1020) ; fin = 20 × 120 = 2400 ; apports = 1100
    expect(s.contributions).toBeCloseTo(1100, 9);
    expect(s.gain).toBeCloseTo(2400 - 1020 - 1100, 9);
    expect(s.gainPct).toBeCloseTo((280 / (1020 + 1100)) * 100, 9);
    expect(s.points[0]!.date).toBe('2026-09-01');
  });

  it('« Tout » : gain = valeur - apports depuis le début', () => {
    const snaps = buildHistory([order('1', 'buy', 10, 100, '2026-08-24T08:00:00Z')], closes, []);
    const s = periodStats(snaps, 'all', '2026-09-26')!;
    expect(s.gain).toBeCloseTo(200, 9);
    expect(s.gainPct).toBeCloseTo(20, 9);
    expect(s.points).toHaveLength(5);
  });

  it('les frais réduisent le gain', () => {
    const snaps = buildHistory(
      [order('1', 'buy', 10, 100, '2026-08-24T08:00:00Z', 10)],
      closes,
      [],
    );
    expect(periodStats(snaps, 'all', '2026-09-26')!.gain).toBeCloseTo(190, 9);
  });

  it('période sans point : null', () => {
    const snaps = buildHistory([order('1', 'buy', 10, 100, '2026-08-24T08:00:00Z')], closes, []);
    expect(periodStats(snaps, '1m', '2027-01-01')).toBeNull();
    expect(periodStats([], 'all', '2026-09-26')).toBeNull();
  });
});

describe('incomeFlows', () => {
  it('garde les dividendes (+) et les frais (−), ignore versements et retraits', () => {
    expect(
      incomeFlows([
        { kind: 'deposit', amount: 1000, occurredOn: '2026-01-02' },
        { kind: 'dividend', amount: 12, occurredOn: '2026-03-01' },
        { kind: 'fee', amount: 3, occurredOn: '2026-04-01' },
        { kind: 'withdrawal', amount: 50, occurredOn: '2026-05-01' },
      ]),
    ).toEqual([
      { date: '2026-03-01', amount: 12 },
      { date: '2026-04-01', amount: -3 },
    ]);
  });
});

describe('periodStats : TWR et TRI', () => {
  const snap = (date: string, marketValue: number, netContributions: number) => ({
    date,
    marketValue,
    netContributions,
    costBasis: netContributions,
    realizedPl: 0,
    income: 0,
  });

  it('TWR insensible à un apport ; TRI absent sur moins d’un an', () => {
    const snaps = [
      snap('2026-09-01', 1000, 1000),
      snap('2026-09-02', 1100, 1000),
      snap('2026-09-03', 11_100, 11_000),
    ];
    const s = periodStats(snaps, 'all', '2026-09-03')!;
    expect(s.twrPct).toBeCloseTo(10, 9);
    expect(s.gainPct).toBeCloseTo((100 / 11_000) * 100, 9);
    expect(s.xirrPct).toBeNull();
  });

  it('TRI annualisé sur plus d’un an', () => {
    const snaps = [snap('2025-01-01', 1000, 1000), snap('2026-01-01', 1100, 1000)];
    expect(periodStats(snaps, 'all', '2026-01-01')!.xirrPct).toBeCloseTo(10, 3);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildPortfolioView,
  quoteFreshness,
  type InstrumentRow,
  type OrderRow,
  type QuoteRow,
} from './portfolio-view';

const inst: InstrumentRow[] = [
  { id: 'a', symbol: 'CW8.PA', name: 'World' },
  { id: 'b', symbol: 'MC.PA', name: 'LVMH' },
];
const o = (
  id: string,
  instrumentId: string,
  side: 'buy' | 'sell',
  quantity: number,
  unitPrice: number,
  executedAt: string,
  fees = 0,
): OrderRow => ({ id, instrumentId, side, quantity, unitPrice, fees, executedAt });

const q = (instrumentId: string, price: number, prevClose: number | null): QuoteRow => ({
  instrumentId,
  price,
  prevClose,
  quotedAt: '2026-09-25T15:35:00Z',
  fetchedAt: '2026-09-25T15:36:00Z',
});

describe('buildPortfolioView', () => {
  const orders = [
    o('1', 'a', 'buy', 10, 100, '2026-09-01T10:00:00Z', 5),
    o('2', 'b', 'buy', 2, 400, '2026-09-02T10:00:00Z'),
    o('3', 'b', 'sell', 1, 420, '2026-09-10T10:00:00Z'),
  ];
  const quotes = new Map([
    ['a', q('a', 110, 108)],
    ['b', q('b', 396, 400)],
  ]);

  it('lignes, gains latents et gain du jour', () => {
    const { rows, totals } = buildPortfolioView(orders, inst, quotes);
    const a = rows.find((r) => r.symbol === 'CW8.PA')!;
    expect(a.quantity).toBe(10);
    expect(a.avgCost).toBeCloseTo(100.5, 9);
    expect(a.marketValue).toBe(1100);
    expect(a.unrealizedPl).toBeCloseTo(95, 9);
    expect(a.dayPl).toBeCloseTo(20, 9);
    const b = rows.find((r) => r.symbol === 'MC.PA')!;
    expect(b.quantity).toBe(1);
    expect(b.dayPl).toBeCloseTo(-4, 9);

    expect(totals.marketValue).toBeCloseTo(1496, 9);
    expect(totals.costBasis).toBeCloseTo(1405, 9);
    expect(totals.unrealizedPl).toBeCloseTo(91, 9);
    expect(totals.dayPl).toBeCloseTo(16, 9);
    expect(totals.realizedPl).toBeCloseTo(20, 9);
    expect(totals.sessionDate).toBe('2026-09-25');
    expect(totals.missingQuotes).toBe(0);
  });

  it('trie par valeur décroissante', () => {
    const { rows } = buildPortfolioView(orders, inst, quotes);
    expect(rows.map((r) => r.symbol)).toEqual(['CW8.PA', 'MC.PA']);
  });

  it('ligne sans cote : retenue à son coût et signalée', () => {
    const { rows, totals } = buildPortfolioView(orders, inst, new Map([['a', q('a', 110, 108)]]));
    expect(rows.find((r) => r.symbol === 'MC.PA')!.marketValue).toBeNull();
    expect(totals.missingQuotes).toBe(1);
    expect(totals.marketValue).toBeCloseTo(1100 + 400, 9);
  });

  it('position soldée : absente des lignes, plus-value comptée', () => {
    const closed = [
      o('1', 'a', 'buy', 5, 100, '2026-09-01T10:00:00Z'),
      o('2', 'a', 'sell', 5, 110, '2026-09-02T10:00:00Z'),
    ];
    const { rows, totals } = buildPortfolioView(closed, inst, quotes);
    expect(rows).toHaveLength(0);
    expect(totals.realizedPl).toBeCloseTo(50, 9);
    expect(totals.marketValue).toBe(0);
    expect(totals.dayPlPct).toBeNull();
  });

  it('sans clôture veille : pas de gain du jour pour la ligne', () => {
    const { rows } = buildPortfolioView(orders, inst, new Map([['a', q('a', 110, null)]]));
    expect(rows.find((r) => r.symbol === 'CW8.PA')!.dayPl).toBeNull();
  });
});

describe('quoteFreshness', () => {
  const quotedAt = '2026-09-25T10:00:00Z';
  it('en direct en séance', () => {
    expect(quoteFreshness(quotedAt, new Date('2026-09-25T10:01:00Z'))).toEqual({ kind: 'live' });
  });
  it('différée si la cote est ancienne en séance', () => {
    expect(quoteFreshness(quotedAt, new Date('2026-09-25T10:16:00Z'))).toEqual({
      kind: 'delayed',
      minutes: 16,
    });
  });
  it('clôturée hors séance', () => {
    expect(quoteFreshness(quotedAt, new Date('2026-09-26T10:00:00Z'))).toEqual({
      kind: 'closed',
      at: quotedAt,
    });
  });
});

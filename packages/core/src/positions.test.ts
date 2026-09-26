import { describe, expect, it } from 'vitest';
import { computePosition, OversellError, sortOrders } from './positions';
import type { Order } from './types';

let n = 0;
const order = (
  o: Partial<Order> & Pick<Order, 'side' | 'quantity' | 'unitPrice' | 'executedAt'>,
): Order => ({
  id: `o${++n}`,
  fees: 0,
  ...o,
});

describe('computePosition (PMP)', () => {
  it('un achat simple : PRU = prix + frais / quantité', () => {
    const p = computePosition([
      order({
        side: 'buy',
        quantity: 10,
        unitPrice: 100,
        fees: 5,
        executedAt: '2026-01-05T10:00:00Z',
      }),
    ]);
    expect(p.quantity).toBe(10);
    expect(p.avgCost).toBeCloseTo(100.5, 9);
    expect(p.costBasis).toBeCloseTo(1005, 9);
    expect(p.realizedPl).toBe(0);
  });

  it('deux achats : le PRU est la moyenne pondérée, frais inclus', () => {
    const p = computePosition([
      order({
        side: 'buy',
        quantity: 10,
        unitPrice: 100,
        fees: 5,
        executedAt: '2026-01-05T10:00:00Z',
      }),
      order({
        side: 'buy',
        quantity: 30,
        unitPrice: 110,
        fees: 3,
        executedAt: '2026-01-06T10:00:00Z',
      }),
    ]);
    // (1005 + 3303) / 40
    expect(p.quantity).toBe(40);
    expect(p.avgCost).toBeCloseTo(107.7, 9);
  });

  it('vente partielle : PRU inchangé, plus-value réalisée nette de frais', () => {
    const p = computePosition([
      order({
        side: 'buy',
        quantity: 10,
        unitPrice: 100,
        fees: 0,
        executedAt: '2026-01-05T10:00:00Z',
      }),
      order({
        side: 'sell',
        quantity: 4,
        unitPrice: 120,
        fees: 2,
        executedAt: '2026-01-07T10:00:00Z',
      }),
    ]);
    expect(p.quantity).toBe(6);
    expect(p.avgCost).toBeCloseTo(100, 9);
    // (120*4 - 2) - 100*4 = 78
    expect(p.realizedPl).toBeCloseTo(78, 9);
    expect(p.costBasis).toBeCloseTo(600, 9);
  });

  it("les ordres sont rejoués par date, quel que soit l'ordre du tableau", () => {
    const a = order({
      side: 'buy',
      quantity: 10,
      unitPrice: 100,
      executedAt: '2026-01-05T10:00:00Z',
    });
    const b = order({
      side: 'sell',
      quantity: 5,
      unitPrice: 110,
      executedAt: '2026-01-06T10:00:00Z',
    });
    expect(computePosition([b, a]).quantity).toBe(5);
  });

  it('clôture complète puis rachat : le PRU repart de zéro', () => {
    const p = computePosition([
      order({ side: 'buy', quantity: 10, unitPrice: 100, executedAt: '2026-01-05T10:00:00Z' }),
      order({ side: 'sell', quantity: 10, unitPrice: 90, executedAt: '2026-01-06T10:00:00Z' }),
      order({ side: 'buy', quantity: 5, unitPrice: 50, executedAt: '2026-01-07T10:00:00Z' }),
    ]);
    expect(p.quantity).toBe(5);
    expect(p.avgCost).toBeCloseTo(50, 9);
    expect(p.realizedPl).toBeCloseTo(-100, 9);
  });

  it('rejette une vente à découvert', () => {
    expect(() =>
      computePosition([
        order({ side: 'buy', quantity: 5, unitPrice: 100, executedAt: '2026-01-05T10:00:00Z' }),
        order({ side: 'sell', quantity: 6, unitPrice: 100, executedAt: '2026-01-06T10:00:00Z' }),
      ]),
    ).toThrow(OversellError);
  });

  it("rejette une vente antérieure à l'achat correspondant", () => {
    expect(() =>
      computePosition([
        order({ side: 'buy', quantity: 5, unitPrice: 100, executedAt: '2026-01-06T10:00:00Z' }),
        order({ side: 'sell', quantity: 5, unitPrice: 100, executedAt: '2026-01-05T10:00:00Z' }),
      ]),
    ).toThrow(OversellError);
  });

  it("achat et vente au même instant : achat d'abord (comme en base)", () => {
    const t = '2026-01-05T10:00:00Z';
    const p = computePosition([
      order({ side: 'sell', quantity: 5, unitPrice: 110, executedAt: t }),
      order({ side: 'buy', quantity: 5, unitPrice: 100, executedAt: t }),
    ]);
    expect(p.quantity).toBe(0);
    expect(p.realizedPl).toBeCloseTo(50, 9);
  });

  it('aucune position : tout à zéro', () => {
    expect(computePosition([])).toEqual({ quantity: 0, avgCost: 0, costBasis: 0, realizedPl: 0 });
  });
});

describe('sortOrders', () => {
  it('trie par date puis achat avant vente puis id', () => {
    const t = '2026-01-05T10:00:00Z';
    const sorted = sortOrders([
      { id: 'b', side: 'sell', quantity: 1, unitPrice: 1, fees: 0, executedAt: t },
      { id: 'a', side: 'buy', quantity: 1, unitPrice: 1, fees: 0, executedAt: t },
      {
        id: 'z',
        side: 'buy',
        quantity: 1,
        unitPrice: 1,
        fees: 0,
        executedAt: '2026-01-04T10:00:00Z',
      },
    ]);
    expect(sorted.map((o) => o.id)).toEqual(['z', 'a', 'b']);
  });
});

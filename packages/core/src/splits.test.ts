import { describe, expect, it } from 'vitest';
import { computePosition } from './positions';
import { adjustForSplits, adjustOrdersBySplits, splitFactor, type Split } from './splits';
import type { Order } from './types';

const split = (effectiveOn: string, from: number, to: number): Split => ({
  instrumentId: 'i1',
  effectiveOn,
  from,
  to,
});

const buy: Order = {
  id: 'a',
  side: 'buy',
  quantity: 10,
  unitPrice: 500,
  fees: 2,
  executedAt: '2026-05-04T08:00:00Z',
};
const sell: Order = {
  id: 'b',
  side: 'sell',
  quantity: 50,
  unitPrice: 60,
  fees: 1,
  executedAt: '2026-06-02T08:00:00Z',
};

describe('splitFactor', () => {
  it('produit des splits postérieurs à la date (Paris)', () => {
    const splits = [split('2026-06-01', 1, 10), split('2026-09-01', 2, 1)];
    expect(splitFactor(splits, '2026-05-04T08:00:00Z')).toBe(5);
    expect(splitFactor(splits, '2026-06-02T08:00:00Z')).toBe(0.5);
    expect(splitFactor(splits, '2026-10-01T08:00:00Z')).toBe(1);
    // le jour d'effet est déjà sur la nouvelle base
    expect(splitFactor(splits, '2026-06-01T07:00:00Z')).toBe(0.5);
  });
});

describe('adjustForSplits', () => {
  it('division par 10 : quantité × 10, prix ÷ 10, montant et frais inchangés', () => {
    const [a] = adjustForSplits([buy], [split('2026-06-01', 1, 10)]);
    expect(a).toMatchObject({ quantity: 100, unitPrice: 50, fees: 2 });
  });

  it('rend possible la vente des titres issus de la division, PRU sur la nouvelle base', () => {
    expect(() => computePosition([buy, sell])).toThrow();
    const pos = computePosition(adjustForSplits([buy, sell], [split('2026-06-01', 1, 10)]));
    expect(pos.quantity).toBe(50);
    expect(pos.avgCost).toBeCloseTo(50.02, 6); // (5000 + 2) / 100
    expect(pos.realizedPl).toBeCloseTo(50 * 60 - 1 - 50 * 50.02, 6);
  });

  it('sans split : ordres inchangés', () => {
    expect(adjustForSplits([buy], [])).toEqual([buy]);
  });
});

describe('adjustOrdersBySplits', () => {
  it("n'applique à chaque ordre que les splits de son instrument", () => {
    const orders = [
      { ...buy, instrumentId: 'i1' },
      { ...buy, id: 'c', instrumentId: 'i2' },
    ];
    const out = adjustOrdersBySplits(orders, [split('2026-06-01', 1, 10)]);
    expect(out.map((o) => o.quantity)).toEqual([100, 10]);
  });
});

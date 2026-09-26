import { describe, expect, it } from 'vitest';
import { dayPl, valuePosition } from './valuation';
import type { Order } from './types';

const o = (
  id: string,
  side: 'buy' | 'sell',
  quantity: number,
  unitPrice: number,
  executedAt: string,
): Order => ({
  id,
  side,
  quantity,
  unitPrice,
  fees: 0,
  executedAt,
});

describe('valuePosition', () => {
  it('valeur, gain latent et pourcentages', () => {
    const v = valuePosition(
      { quantity: 10, avgCost: 100, costBasis: 1000, realizedPl: 0 },
      110,
      108,
    );
    expect(v.marketValue).toBe(1100);
    expect(v.unrealizedPl).toBe(100);
    expect(v.unrealizedPlPct).toBeCloseTo(10, 9);
    expect(v.dayChangePct).toBeCloseTo((110 / 108 - 1) * 100, 9);
  });

  it('sans clôture veille ni position : pourcentages nuls', () => {
    const v = valuePosition({ quantity: 0, avgCost: 0, costBasis: 0, realizedPl: 0 }, 50, null);
    expect(v.unrealizedPlPct).toBeNull();
    expect(v.dayChangePct).toBeNull();
    expect(v.marketValue).toBe(0);
  });
});

describe('dayPl', () => {
  const day = '2026-09-25'; // ordres aujourd'hui = 2026-09-25 (Paris)

  it('position détenue la veille : quantité × (cours − clôture veille)', () => {
    const orders = [o('a', 'buy', 10, 100, '2026-09-01T10:00:00Z')];
    expect(dayPl(orders, day, 105, 100)).toBeCloseTo(50, 9);
  });

  it("achat du jour : compté depuis le prix d'achat, pas la clôture veille", () => {
    const orders = [
      o('a', 'buy', 10, 100, '2026-09-01T10:00:00Z'),
      o('b', 'buy', 5, 104, '2026-09-25T08:00:00Z'),
    ];
    // 10*(105-100) + 5*(105-104)
    expect(dayPl(orders, day, 105, 100)).toBeCloseTo(55, 9);
  });

  it('vente du jour de titres détenus la veille', () => {
    const orders = [
      o('a', 'buy', 10, 100, '2026-09-01T10:00:00Z'),
      o('b', 'sell', 4, 103, '2026-09-25T08:00:00Z'),
    ];
    // 4*(103-100) + 6*(105-100)
    expect(dayPl(orders, day, 105, 100)).toBeCloseTo(42, 9);
  });

  it('achat puis revente le même jour', () => {
    const orders = [
      o('a', 'buy', 5, 104, '2026-09-25T08:00:00Z'),
      o('b', 'sell', 5, 106, '2026-09-25T09:00:00Z'),
    ];
    // achat: 5*(105-104)=5 ; revente: 5*(106-105)=5 => (106-104)*5 = 10
    expect(dayPl(orders, day, 105, 100)).toBeCloseTo(10, 9);
  });

  it("ordre passé la veille au soir (Paris) n'est pas un ordre du jour", () => {
    // 2026-09-24T21:30Z = 23:30 à Paris le 24 : détenu à la clôture de la veille
    const orders = [o('a', 'buy', 10, 100, '2026-09-24T21:30:00Z')];
    expect(dayPl(orders, day, 105, 100)).toBeCloseTo(50, 9);
  });
});

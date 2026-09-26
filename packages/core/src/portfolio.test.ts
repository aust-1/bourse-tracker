import { describe, expect, it } from 'vitest';
import { buildSnapshots } from './portfolio';
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

describe('buildSnapshots', () => {
  const inst = {
    orders: [
      o('a', 'buy', 10, 100, '2026-09-22T09:00:00Z'),
      o('b', 'sell', 4, 112, '2026-09-24T09:00:00Z'),
    ],
    closes: [
      { date: '2026-09-22', close: 101 },
      { date: '2026-09-23', close: 105 },
      { date: '2026-09-24', close: 110 },
    ],
  };

  it('valorise chaque jour à la clôture, en tenant compte des ordres du jour', () => {
    const s = buildSnapshots([inst], ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24']);
    expect(s[0]).toMatchObject({ marketValue: 0, costBasis: 0, realizedPl: 0 });
    expect(s[1]).toMatchObject({ marketValue: 1010, costBasis: 1000, realizedPl: 0 });
    expect(s[2]).toMatchObject({ marketValue: 1050, costBasis: 1000 });
    expect(s[3]).toMatchObject({ marketValue: 660, costBasis: 600, realizedPl: 48 });
  });

  it('reporte la dernière clôture connue (jour sans cotation)', () => {
    const s = buildSnapshots([inst], ['2026-09-26']);
    expect(s[0]!.marketValue).toBe(660);
  });

  it('sans clôture connue, la ligne est valorisée à son coût', () => {
    const s = buildSnapshots(
      [{ orders: [o('a', 'buy', 2, 50, '2026-09-22T09:00:00Z')], closes: [] }],
      ['2026-09-22'],
    );
    expect(s[0]).toMatchObject({ marketValue: 100, costBasis: 100 });
  });

  it('additionne plusieurs instruments', () => {
    const other = {
      orders: [o('c', 'buy', 1, 20, '2026-09-22T09:00:00Z')],
      closes: [{ date: '2026-09-22', close: 30 }],
    };
    const s = buildSnapshots([inst, other], ['2026-09-22']);
    expect(s[0]!.marketValue).toBe(1040);
  });
});

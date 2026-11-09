import { describe, expect, it } from 'vitest';
import { avgCostSeries, buildSnapshots } from './portfolio';
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

  it('dividendes et frais : revenus cumulés, retranchés des apports (un dividende est un gain)', () => {
    const s = buildSnapshots(
      [inst],
      ['2026-09-22', '2026-09-23', '2026-09-24'],
      [
        { date: '2026-09-24', amount: -2 },
        { date: '2026-09-23', amount: 15 },
      ],
    );
    expect(s[0]).toMatchObject({ income: 0, netContributions: 1000 });
    expect(s[1]).toMatchObject({ income: 15, netContributions: 985 });
    // vente de 4 × 112 = 448 ; frais de garde de 2 €
    expect(s[2]).toMatchObject({ income: 13, netContributions: 1000 - 448 - 13 });
    // gain = valeur − apports = 660 − 539 = 121 = 60 latent + 48 réalisé + 13 de revenus
    expect(s[2]!.marketValue - s[2]!.netContributions).toBe(121);
  });

  it('valorise chaque jour à la clôture, en tenant compte des ordres du jour', () => {
    const s = buildSnapshots([inst], ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24']);
    expect(s[0]).toMatchObject({ marketValue: 0, costBasis: 0, realizedPl: 0 });
    expect(s[1]).toMatchObject({ marketValue: 1010, costBasis: 1000, realizedPl: 0 });
    expect(s[2]).toMatchObject({ marketValue: 1050, costBasis: 1000 });
    expect(s[3]).toMatchObject({ marketValue: 660, costBasis: 600, realizedPl: 48 });
  });

  it('apports nets cumulés : achats moins produit des ventes', () => {
    const s = buildSnapshots([inst], ['2026-09-22', '2026-09-23', '2026-09-24']);
    expect(s.map((x) => x.netContributions)).toEqual([1000, 1000, 1000 - 448]);
    // gain hors apports = valeur - apports : 660 - 552 = 108 (dont 48 réalisés)
    expect(s[2]!.marketValue - s[2]!.netContributions).toBe(108);
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

describe('avgCostSeries', () => {
  const at = (iso: string) => Date.parse(iso);
  const orders = [
    o('a', 'buy', 1, 100, '2026-09-22T09:00:00Z'),
    o('b', 'buy', 2, 130, '2026-09-24T09:00:00Z'),
  ];

  it('suit le PRU pondéré au fil des achats', () => {
    const s = avgCostSeries(orders, [
      at('2026-09-22T08:00:00Z'),
      at('2026-09-22T10:00:00Z'),
      at('2026-09-23T10:00:00Z'),
      at('2026-09-24T10:00:00Z'),
    ]);
    // 1 à 100 puis 2 à 130 : PRU aux 2/3 entre les deux
    expect(s).toEqual([null, 100, 100, 120]);
  });

  it('byDay : un ordre compte dès le point de sa journée', () => {
    const s = avgCostSeries(orders, [at('2026-09-22T07:00:00Z'), at('2026-09-24T07:00:00Z')], true);
    expect(s).toEqual([100, 120]);
  });

  it('null une fois la position soldée', () => {
    const s = avgCostSeries(
      [...orders, o('c', 'sell', 3, 140, '2026-09-25T09:00:00Z')],
      [at('2026-09-25T10:00:00Z')],
    );
    expect(s).toEqual([null]);
  });
});

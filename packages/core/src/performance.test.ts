import { describe, expect, it } from 'vitest';
import { periodCashFlows, twr, xirr, type ValuePoint } from './performance';

const p = (date: string, marketValue: number, netContributions: number): ValuePoint => ({
  date,
  marketValue,
  netContributions,
});

describe('twr', () => {
  it('un seul achat : rendement = évolution du cours, y compris le premier jour', () => {
    // achat de 1 000 € ; 1 010 le soir, 1 100 le lendemain
    expect(twr([p('2026-01-05', 1010, 1000), p('2026-01-06', 1100, 1000)])).toBeCloseTo(10, 9);
  });

  it('neutralise un gros apport : seul le rendement des placements compte', () => {
    // +10 % puis apport de 10 000 € qui ne bouge pas : TWR = 10 %, alors que le gain simple
    // rapporté au capital serait dilué
    const pts = [
      p('2026-01-05', 1000, 1000),
      p('2026-01-06', 1100, 1000),
      p('2026-01-07', 11_100, 11_000),
    ];
    expect(twr(pts)).toBeCloseTo(10, 9);
  });

  it('retrait (vente) compté en fin de journée', () => {
    // 1 000 → 1 200 (+20 %), puis vente totale à 1 200 : la valeur tombe à 0
    const pts = [
      p('2026-01-05', 1000, 1000),
      p('2026-01-06', 1200, 1000),
      p('2026-01-07', 0, -200),
    ];
    expect(twr(pts)).toBeCloseTo(20, 9);
  });

  it('avec une base : la période part de la valeur de veille', () => {
    expect(twr([p('2026-02-02', 1050, 1000)], p('2026-01-30', 1000, 1000))).toBeCloseTo(5, 9);
  });

  it('rien de mesurable', () => {
    expect(twr([])).toBeNull();
    expect(twr([p('2026-01-05', 0, 0)])).toBeNull();
  });
});

describe('xirr', () => {
  it('1 000 € devenus 1 100 € en un an : 10 %', () => {
    expect(
      xirr([
        { date: '2025-01-01', amount: -1000 },
        { date: '2026-01-01', amount: 1100 },
      ]),
    ).toBeCloseTo(10, 4);
  });

  it('versements étalés', () => {
    // −1000 au départ, −1000 à 6 mois, 2 200 à un an : 1000(1+r) + 1000(1+r)^0,5 = 2200, r ≈ 13,5 %
    const r = xirr([
      { date: '2025-01-01', amount: -1000 },
      { date: '2025-07-02', amount: -1000 },
      { date: '2026-01-01', amount: 2200 },
    ]);
    expect(r).toBeGreaterThan(13.4);
    expect(r).toBeLessThan(13.5);
  });

  it('sans changement de signe : pas de TRI', () => {
    expect(xirr([{ date: '2025-01-01', amount: -1000 }])).toBeNull();
    expect(
      xirr([
        { date: '2025-01-01', amount: 1000 },
        { date: '2026-01-01', amount: 1100 },
      ]),
    ).toBeNull();
  });
});

describe('periodCashFlows', () => {
  it('base, apports, valeur finale', () => {
    expect(
      periodCashFlows(
        [p('2026-01-05', 1100, 1000), p('2026-01-06', 2300, 2000)],
        p('2026-01-02', 1000, 1000),
      ),
    ).toEqual([
      { date: '2026-01-02', amount: -1000 },
      { date: '2026-01-06', amount: -1000 },
      { date: '2026-01-06', amount: 2300 },
    ]);
  });
});

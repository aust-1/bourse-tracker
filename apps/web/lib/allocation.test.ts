import { describe, expect, it } from 'vitest';
import { allocation } from './allocation';

describe('allocation', () => {
  const rows = [
    { name: 'World', marketValue: 6000, costBasis: 5000, assetType: 'etf' as const },
    { name: 'LVMH', marketValue: 2000, costBasis: 2500, assetType: 'equity' as const },
    { name: 'Sans cote', marketValue: null, costBasis: 1000, assetType: null },
  ];

  it('par ligne et par type, triés, une ligne sans cote à son prix de revient', () => {
    const a = allocation(rows, 1000);
    expect(a.total).toBe(10_000);
    expect(a.byLine.map((s) => [s.label, s.pct])).toEqual([
      ['World', 60],
      ['LVMH', 20],
      ['Sans cote', 10],
      ['Liquidités', 10],
    ]);
    expect(a.byType.map((s) => [s.label, s.pct])).toEqual([
      ['ETF', 60],
      ['Actions', 20],
      ['Non classé', 10],
      ['Liquidités', 10],
    ]);
  });

  it('liquidités négatives ou inconnues : ignorées', () => {
    expect(allocation(rows, -500).total).toBe(9000);
    expect(allocation(rows).byLine).toHaveLength(3);
  });

  it('portefeuille vide', () => {
    expect(allocation([], null)).toEqual({ byLine: [], byType: [], total: 0 });
  });
});

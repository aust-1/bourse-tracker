import { describe, expect, it } from 'vitest';
import { capStatus, cashEffect, summarizeCash } from './cash';

describe('summarizeCash', () => {
  it('solde = versements − retraits + dividendes − frais − achats + ventes', () => {
    const s = summarizeCash(
      [
        { side: 'buy', quantity: 10, unitPrice: 100, fees: 2 },
        { side: 'sell', quantity: 4, unitPrice: 120, fees: 1 },
      ],
      [
        { kind: 'deposit', amount: 2000 },
        { kind: 'withdrawal', amount: 300 },
        { kind: 'dividend', amount: 15 },
        { kind: 'fee', amount: 5 },
      ],
    );
    expect(s).toEqual({
      deposits: 2000,
      withdrawals: 300,
      dividends: 15,
      fees: 5,
      netInvested: 1002 - 479,
      balance: 2000 - 300 + 15 - 5 - 1002 + 479,
    });
  });

  it('sans mouvement : solde négatif égal aux achats nets', () => {
    expect(summarizeCash([{ side: 'buy', quantity: 1, unitPrice: 50, fees: 0 }], []).balance).toBe(
      -50,
    );
  });
});

describe('cashEffect', () => {
  it.each([
    ['deposit', 10],
    ['dividend', 10],
    ['withdrawal', -10],
    ['fee', -10],
  ] as const)('%s → %i', (kind, expected) => {
    expect(cashEffect({ kind, amount: 10 })).toBe(expected);
  });
});

describe('capStatus', () => {
  it('PEA : 150 000 € ; PEA + PEA-PME : 225 000 €', () => {
    const s = capStatus({ pea: 100_000, pea_pme: 50_000 });
    expect(s.pea).toMatchObject({ cap: 150_000, used: 100_000, remaining: 50_000 });
    expect(s.pea.usedPct).toBeCloseTo(66.67, 2);
    expect(s.combined).toMatchObject({ cap: 225_000, used: 150_000, remaining: 75_000 });
  });

  it('plafond dépassé : reste nul', () => {
    expect(capStatus({ pea: 160_000, pea_pme: 0 }).pea.remaining).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import type { Snapshot } from './portfolio';
import { dayChangePctOnTotal, tracksCash, withCash } from './total-value';

const snap = (date: string, marketValue: number, netContributions: number): Snapshot => ({
  date,
  marketValue,
  costBasis: netContributions,
  realizedPl: 0,
  netContributions,
  income: 0,
});

describe('withCash', () => {
  // versement de 10 000 € le 02/01 ; achat de 50 titres à 100 € le 05/01 ; cours 100 puis 110
  const movements = [{ kind: 'deposit' as const, amount: 10_000, occurredOn: '2026-01-02' }];
  const orders = [
    {
      side: 'buy' as const,
      quantity: 50,
      unitPrice: 100,
      fees: 0,
      executedAt: '2026-01-05T09:00:00Z',
    },
  ];
  const snaps = [snap('2026-01-05', 5000, 5000), snap('2026-01-06', 5500, 5000)];

  it('l’achat ne change pas la valeur totale ; le versement est le seul apport', () => {
    const s = withCash(snaps, orders, movements);
    expect(s.map((x) => [x.marketValue, x.netContributions])).toEqual([
      [10_000, 10_000],
      [10_500, 10_000],
    ]);
  });

  it('dividende : passe par les liquidités, compté dans le gain', () => {
    const s = withCash(snaps, orders, [
      ...movements,
      { kind: 'dividend' as const, amount: 20, occurredOn: '2026-01-06' },
    ]);
    expect(s[1]!.marketValue - s[1]!.netContributions).toBe(520);
  });

  it('retrait : apport négatif', () => {
    const s = withCash(snaps, orders, [
      ...movements,
      { kind: 'withdrawal' as const, amount: 1000, occurredOn: '2026-01-06' },
    ]);
    expect(s[1]).toMatchObject({ marketValue: 9500, netContributions: 9000 });
  });
});

describe('tracksCash', () => {
  it('seulement avec un versement', () => {
    expect(tracksCash([])).toBe(false);
    expect(tracksCash([{ kind: 'dividend', amount: 1, occurredOn: '2026-01-01' }])).toBe(false);
    expect(tracksCash([{ kind: 'deposit', amount: 1, occurredOn: '2026-01-01' }])).toBe(true);
  });
});

describe('dayChangePctOnTotal', () => {
  it('achat du jour payé par les liquidités : la base reste la valeur de la veille', () => {
    // veille : 10 000 € de liquidités ; achat de 5 000 € ce matin, qui vaut 5 100 € ce soir
    expect(
      dayChangePctOnTotal({
        marketValue: 5100,
        dayPl: 100,
        cashBalance: 5000,
        netDepositsToday: 0,
      }),
    ).toBeCloseTo(1); // 100 / 10 000
  });

  it('versement du jour : exclu de la base', () => {
    expect(
      dayChangePctOnTotal({
        marketValue: 1000,
        dayPl: 10,
        cashBalance: 2000,
        netDepositsToday: 1000,
      }),
    ).toBeCloseTo((10 / 1990) * 100);
  });

  it('base nulle : pas de pourcentage', () => {
    expect(
      dayChangePctOnTotal({ marketValue: 0, dayPl: 0, cashBalance: 0, netDepositsToday: 0 }),
    ).toBe(null);
  });
});

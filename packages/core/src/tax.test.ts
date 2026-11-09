import { describe, expect, it } from 'vitest';
import { estimatePeaTax } from './tax';

const base = {
  today: '2026-11-10',
  value: 30_000,
  deposits: 20_000,
  withdrawals: 0,
  socialRate: 17.2,
  incomeRate: 12.8,
};

describe('estimatePeaTax', () => {
  it('après 5 ans : prélèvements sociaux seuls', () => {
    const t = estimatePeaTax({ ...base, openedOn: '2019-03-01' });
    expect(t).toMatchObject({ maturityOn: '2024-03-01', ageYears: 7, matured: true, gain: 10_000 });
    expect(t.rate).toBeCloseTo(17.2, 9);
    expect(t.tax).toBeCloseTo(1720, 6);
  });

  it('avant 5 ans : prélèvements sociaux + impôt sur le revenu', () => {
    const t = estimatePeaTax({ ...base, openedOn: '2023-06-15' });
    expect(t).toMatchObject({ maturityOn: '2028-06-15', ageYears: 3, matured: false });
    expect(t.tax).toBeCloseTo(3000, 6);
  });

  it("date d'ouverture inconnue : hypothèse prudente (taux complet)", () => {
    const t = estimatePeaTax({ ...base, openedOn: null });
    expect(t).toMatchObject({ maturityOn: null, ageYears: null, matured: null });
    expect(t.rate).toBeCloseTo(30, 9);
  });

  it('moins-value : aucun impôt ; les retraits réduisent la base', () => {
    expect(estimatePeaTax({ ...base, openedOn: '2019-03-01', value: 15_000 }).tax).toBe(0);
    expect(
      estimatePeaTax({ ...base, openedOn: '2019-03-01', withdrawals: 5_000, value: 20_000 }).gain,
    ).toBe(5_000);
  });

  it('veille des 5 ans : pas encore acquis ; 29 février', () => {
    expect(estimatePeaTax({ ...base, openedOn: '2021-11-11' }).matured).toBe(false);
    expect(estimatePeaTax({ ...base, openedOn: '2020-02-29' }).maturityOn).toBe('2025-02-28');
  });
});

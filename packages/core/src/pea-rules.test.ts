import { describe, expect, it } from 'vitest';
import { peaMovementWarnings, type MovementCheck } from './pea-rules';

const norm = (s: string) => s.replace(/\s/g, ' ');
const base: MovementCheck = {
  kind: 'deposit',
  amount: 1000,
  occurredOn: '2026-09-25',
  portfolio: { kind: 'pea', openedOn: '2019-03-01' },
  deposits: { pea: 0, pea_pme: 0 },
};
const messages = (m: Partial<MovementCheck>) =>
  peaMovementWarnings({ ...base, ...m }).map((w) => ({ code: w.code, message: norm(w.message) }));

describe('peaMovementWarnings', () => {
  it('versement sous le plafond : rien', () => {
    expect(messages({ deposits: { pea: 100_000, pea_pme: 0 } })).toEqual([]);
  });

  it('versement qui dépasse le plafond du PEA : restant et dépassement', () => {
    const w = messages({ amount: 10_000, deposits: { pea: 145_000, pea_pme: 0 } });
    expect(w.map((x) => x.code)).toEqual(['pea_cap']);
    expect(w[0]!.message).toContain('il restait 5 000,00 €');
    expect(w[0]!.message).toContain('dépassement de 5 000,00 €');
  });

  it('PEA-PME : plafond commun de 225 000 €', () => {
    const w = messages({
      amount: 30_000,
      portfolio: { kind: 'pea_pme', openedOn: '2020-01-01' },
      deposits: { pea: 150_000, pea_pme: 50_000 },
    });
    expect(w.map((x) => x.code)).toEqual(['combined_cap']);
    expect(w[0]!.message).toContain('il restait 25 000,00 €');
    expect(w[0]!.message).toContain('dépassement de 5 000,00 €');
  });

  it('PEA au-delà des deux plafonds : deux avertissements', () => {
    const w = messages({ amount: 10_000, deposits: { pea: 149_000, pea_pme: 75_000 } });
    expect(w.map((x) => x.code)).toEqual(['pea_cap', 'combined_cap']);
  });

  it('retrait avant 5 ans : clôture du plan, date des 5 ans', () => {
    const w = messages({ kind: 'withdrawal', portfolio: { kind: 'pea', openedOn: '2023-02-10' } });
    expect(w.map((x) => x.code)).toEqual(['early_withdrawal']);
    expect(w[0]!.message).toContain('le 10/02/2028');
  });

  it('retrait après 5 ans : rien', () => {
    expect(messages({ kind: 'withdrawal' })).toEqual([]);
  });

  it('retrait, date d’ouverture inconnue : avertissement', () => {
    const w = messages({ kind: 'withdrawal', portfolio: { kind: 'pea', openedOn: null } });
    expect(w.map((x) => x.code)).toEqual(['unknown_opening']);
  });

  it('compte-titres, dividendes et frais : jamais', () => {
    expect(
      messages({
        amount: 1_000_000,
        portfolio: { kind: 'cto', openedOn: null },
        deposits: { pea: 150_000, pea_pme: 75_000 },
      }),
    ).toEqual([]);
    expect(messages({ kind: 'dividend', deposits: { pea: 150_000, pea_pme: 0 } })).toEqual([]);
    expect(messages({ kind: 'fee', portfolio: { kind: 'pea', openedOn: null } })).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { parseCashForm } from './cash';

const PF = '50000000-0000-0000-0000-000000000001';
const INST = '10000000-0000-0000-0000-000000000001';

const form = (v: Record<string, string>) => {
  const f = new FormData();
  for (const [k, val] of Object.entries(v)) f.set(k, val);
  return f;
};
const base = {
  portfolioId: PF,
  kind: 'deposit',
  amount: '1 500,50',
  instrumentId: '',
  occurredOn: '2026-01-02',
  note: '',
};

describe('parseCashForm', () => {
  it('versement : montant à la française, sans titre', () => {
    expect(parseCashForm(form({ ...base, instrumentId: INST })).data).toEqual({
      portfolioId: PF,
      kind: 'deposit',
      amount: 1500.5,
      instrumentId: null,
      occurredOn: '2026-01-02',
      note: null,
    });
  });
  it('dividende : titre obligatoire', () => {
    expect(parseCashForm(form({ ...base, kind: 'dividend' })).error).toContain('titre');
    expect(
      parseCashForm(form({ ...base, kind: 'dividend', instrumentId: INST })).data?.instrumentId,
    ).toBe(INST);
  });
  it.each([
    [{ amount: '0' }, 'supérieur à 0'],
    [{ amount: 'abc' }, 'nombre invalide'],
    [{ occurredOn: '2999-01-01' }, 'futur'],
    [{ portfolioId: '' }, 'portefeuille'],
  ])('refuse %o', (patch, message) => {
    expect(parseCashForm(form({ ...base, ...patch })).error).toContain(message);
  });
});

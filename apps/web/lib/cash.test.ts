import { afterEach, describe, expect, it, vi } from 'vitest';
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

  describe('date du jour à Paris', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ['heure d’hiver', '2026-01-15T00:30:00+01:00', '2026-01-15'],
      ['heure d’été', '2026-07-15T00:30:00+02:00', '2026-07-15'],
    ])('accepte la date de Paris à 00:30 (%s)', (_label, now, day) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(now));
      expect(parseCashForm(form({ ...base, occurredOn: day })).data?.occurredOn).toBe(day);
    });

    it('refuse le lendemain à Paris pendant que l’UTC est encore la veille', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T00:30:00+01:00'));
      expect(parseCashForm(form({ ...base, occurredOn: '2026-01-16' })).error).toContain('futur');
    });
  });
});

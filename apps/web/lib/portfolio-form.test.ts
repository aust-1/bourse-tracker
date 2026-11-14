import { afterEach, describe, expect, it, vi } from 'vitest';
import { parsePortfolioForm } from './portfolio-form';

const form = (v: Record<string, string>) => {
  const f = new FormData();
  for (const [k, val] of Object.entries(v)) f.set(k, val);
  return f;
};

describe('parsePortfolioForm', () => {
  it('accepte un PEA avec date d’ouverture', () => {
    expect(
      parsePortfolioForm(form({ name: ' Mon PEA ', kind: 'pea', openedOn: '2019-03-01' })).data,
    ).toEqual({ name: 'Mon PEA', kind: 'pea', openedOn: '2019-03-01' });
  });
  it('date d’ouverture facultative', () => {
    expect(
      parsePortfolioForm(form({ name: 'CTO', kind: 'cto', openedOn: '' })).data?.openedOn,
    ).toBe(null);
  });
  it.each([
    [{ name: '', kind: 'pea', openedOn: '' }, 'Nom requis'],
    [{ name: 'X', kind: 'livret', openedOn: '' }, 'Type invalide'],
    [{ name: 'X', kind: 'pea', openedOn: '2999-01-01' }, 'futur'],
  ])('refuse %o', (v, message) => {
    expect(parsePortfolioForm(form(v)).error).toContain(message);
  });

  describe('date d’ouverture du jour à Paris', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ['heure d’hiver', '2026-01-15T00:30:00+01:00', '2026-01-15'],
      ['heure d’été', '2026-07-15T00:30:00+02:00', '2026-07-15'],
    ])('accepte la date de Paris à 00:30 (%s)', (_label, now, day) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(now));
      expect(
        parsePortfolioForm(form({ name: 'PEA', kind: 'pea', openedOn: day })).data?.openedOn,
      ).toBe(day);
    });

    it('refuse le lendemain à Paris pendant que l’UTC est encore la veille', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T00:30:00+01:00'));
      expect(
        parsePortfolioForm(form({ name: 'PEA', kind: 'pea', openedOn: '2026-01-16' })).error,
      ).toContain('futur');
    });
  });
});

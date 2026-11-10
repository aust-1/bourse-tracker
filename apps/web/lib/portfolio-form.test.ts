import { describe, expect, it } from 'vitest';
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
});

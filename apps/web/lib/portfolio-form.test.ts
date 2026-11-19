import { describe, expect, it } from 'vitest';
import { canDeletePortfolio, parsePortfolioForm } from './portfolio-form';

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

describe('canDeletePortfolio', () => {
  it('portefeuille vide, pas le dernier : supprimable', () => {
    expect(canDeletePortfolio({ orders: 0, movements: 0, portfolios: 2 })).toBe(true);
  });
  it('des mouvements sans ordre : refusé (ils seraient effacés avec lui)', () => {
    expect(canDeletePortfolio({ orders: 0, movements: 1, portfolios: 2 })).toBe(false);
  });
  it('des ordres : refusé', () => {
    expect(canDeletePortfolio({ orders: 3, movements: 0, portfolios: 2 })).toBe(false);
  });
  it('dernier portefeuille du compte : refusé', () => {
    expect(canDeletePortfolio({ orders: 0, movements: 0, portfolios: 1 })).toBe(false);
  });
  it('nombre inconnu (lecture en échec) : refusé', () => {
    expect(canDeletePortfolio({ orders: null, movements: 0, portfolios: 2 })).toBe(false);
    expect(canDeletePortfolio({ orders: 0, movements: null, portfolios: 2 })).toBe(false);
  });
});

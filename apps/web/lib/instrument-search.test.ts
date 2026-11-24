import { describe, expect, it } from 'vitest';
import {
  asYahooSymbol,
  readSearchResponse,
  SEARCH_SIGNED_OUT,
  SEARCH_UNAVAILABLE,
} from './instrument-search';

const hit = {
  symbol: 'AI.PA',
  name: 'Air Liquide',
  exchange: 'PAR',
  exchangeName: 'Paris',
  type: 'EQUITY',
};
const res = (over: Partial<Parameters<typeof readSearchResponse>[0]>) =>
  readSearchResponse({
    ok: true,
    redirected: false,
    url: '/api/instruments/search?q=air',
    body: null,
    ...over,
  });

describe('readSearchResponse', () => {
  it('résultats', () => {
    expect(res({ body: { hits: [hit] } })).toEqual({ kind: 'hits', hits: [hit] });
  });
  it('aucun résultat réel : liste vide', () => {
    expect(res({ body: { hits: [] } })).toEqual({ kind: 'hits', hits: [] });
  });
  it('source en panne (502) : indisponible, pas « aucun résultat »', () => {
    expect(res({ ok: false, body: { hits: [], error: 'Recherche indisponible' } })).toEqual({
      kind: 'unavailable',
      message: SEARCH_UNAVAILABLE,
    });
  });
  it('réponse illisible (HTML) : indisponible', () => {
    expect(res({ body: null }).kind).toBe('unavailable');
  });
  it('redirection vers /login : session expirée', () => {
    expect(res({ redirected: true, url: 'https://bourse.example/login', body: null })).toEqual({
      kind: 'signed_out',
      message: SEARCH_SIGNED_OUT,
    });
  });
});

describe('asYahooSymbol', () => {
  it('reconnaît un symbole', () => {
    expect(asYahooSymbol(' ai.pa ')).toBe('AI.PA');
    expect(asYahooSymbol('^FCHI')).toBe('^FCHI');
    expect(asYahooSymbol('CW8.PA')).toBe('CW8.PA');
  });
  it('ignore un nom', () => {
    expect(asYahooSymbol('air liquide')).toBe(null);
    expect(asYahooSymbol('')).toBe(null);
  });
});

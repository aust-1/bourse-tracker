import type { SearchHit } from '@bourse/providers';

export type SearchOutcome =
  | { kind: 'hits'; hits: SearchHit[] }
  | { kind: 'unavailable'; message: string }
  | { kind: 'signed_out'; message: string };

export const SEARCH_UNAVAILABLE = 'Recherche indisponible, réessaie dans un instant.';
export const SEARCH_SIGNED_OUT = 'Session expirée : reconnecte-toi pour rechercher un titre.';

/**
 * Lit la réponse de `/api/instruments/search`. Une panne de la source (502, `error`) ou une
 * réponse illisible n'est pas « aucun résultat » ; une redirection vers /login (session expirée,
 * réponse HTML) non plus.
 */
export function readSearchResponse(res: {
  ok: boolean;
  redirected: boolean;
  url: string;
  body: unknown;
}): SearchOutcome {
  if (res.redirected && /\/(login|mfa)(\?|$)/.test(new URL(res.url, 'http://x').pathname)) {
    return { kind: 'signed_out', message: SEARCH_SIGNED_OUT };
  }
  const body = res.body as { hits?: unknown; error?: unknown } | null;
  if (!res.ok || !body || typeof body !== 'object' || body.error || !Array.isArray(body.hits)) {
    return { kind: 'unavailable', message: SEARCH_UNAVAILABLE };
  }
  return { kind: 'hits', hits: body.hits as SearchHit[] };
}

/** Saisie qui ressemble à un symbole Yahoo (AI.PA, CW8.PA, ^FCHI…) : proposée telle quelle. */
export function asYahooSymbol(query: string): string | null {
  const s = query.trim().toUpperCase();
  return /^[A-Z0-9^][A-Z0-9.\-=^]{0,19}$/.test(s) ? s : null;
}

/** Script de statistiques (Rybbit auto-hébergé), chargé par le layout racine en production. */
export const ANALYTICS_ORIGIN = 'https://analytics.eliott-roussille.fr';

/** Nonce d'une requête : 128 bits aléatoires, en base64. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** Origines HTTP(S) et WebSocket (Realtime) de Supabase, d'après son URL. */
export function supabaseOrigins(url: string | undefined): string[] {
  if (!url) return [];
  try {
    const u = new URL(url);
    const ws = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return [u.origin, `${ws}//${u.host}`];
  } catch {
    return [];
  }
}

/**
 * Content-Security-Policy du site. Scripts : ceux de Next.js et le script de statistiques portent le
 * nonce de la requête (`'strict-dynamic'` : un script injecté sans nonce ne s'exécute pas).
 * Styles : `'unsafe-inline'`, les graphiques (Recharts) posent des attributs `style`.
 * Requêtes : le site lui-même, Supabase (API et Realtime) et les statistiques.
 */
export function buildCsp({
  nonce,
  supabaseUrl,
  dev = false,
}: {
  nonce: string;
  supabaseUrl?: string;
  dev?: boolean;
}): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ANALYTICS_ORIGIN,
      // développement seulement : React reconstruit les piles d'erreurs avec eval
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", ...supabaseOrigins(supabaseUrl), ANALYTICS_ORIGIN],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

/**
 * En-tête utilisé : `Content-Security-Policy-Report-Only` par défaut (les violations sont signalées
 * dans la console sans rien bloquer), `Content-Security-Policy` avec `CSP_ENFORCE=1`.
 */
export function cspHeaderName(enforce: string | undefined): string {
  return enforce === '1' || enforce === 'true'
    ? 'Content-Security-Policy'
    : 'Content-Security-Policy-Report-Only';
}

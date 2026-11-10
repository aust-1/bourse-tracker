/**
 * Chemin de redirection sûr après un lien reçu par email : uniquement un chemin local
 * (pas d'URL absolue ni de `//hôte` qui enverrait vers un autre site). L'URL est lue comme le
 * navigateur la lira (tabulations et sauts de ligne retirés, `\` lu comme `/`) : `/\t/evil.com`
 * devient `//evil.com` et doit être refusé. On renvoie le chemin normalisé, pas l'entrée brute.
 */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/')) return fallback;
  const base = 'http://local.invalid';
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  return url.pathname + url.search + url.hash;
}

/** Pages réservées aux visiteurs non connectés (un compte connecté est renvoyé à l'accueil). */
const GUEST_ONLY = ['/login', '/signup', '/forgot'];
/** Pages ouvertes à tous (connecté ou non) : retour des liens reçus par email, manifeste PWA. */
const OPEN = ['/auth/', '/manifest.webmanifest'];

/** Vrai si le compte a un second facteur vérifié que la session n'a pas encore présenté. */
export function needsSecondFactor(
  aal: { currentLevel: string | null; nextLevel: string | null } | null,
): boolean {
  return aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
}

export type RouteAccess = 'guest' | 'open' | 'private';

export function routeAccess(pathname: string): RouteAccess {
  if (GUEST_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return 'guest';
  if (OPEN.some((p) => pathname.startsWith(p))) return 'open';
  return 'private';
}

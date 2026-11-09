/**
 * Chemin de redirection sûr après un lien reçu par email : uniquement un chemin local
 * (pas d'URL absolue ni de `//hôte` qui enverrait vers un autre site).
 */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback;
  }
  return next;
}

/** Pages réservées aux visiteurs non connectés (un compte connecté est renvoyé à l'accueil). */
const GUEST_ONLY = ['/login', '/signup', '/forgot'];
/** Pages ouvertes à tous : retour des liens reçus par email (connecté ou non). */
const OPEN = ['/auth/'];

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

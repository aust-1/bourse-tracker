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

export type RouteAccess = 'guest' | 'open' | 'private';

export function routeAccess(pathname: string): RouteAccess {
  if (GUEST_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return 'guest';
  if (OPEN.some((p) => pathname.startsWith(p))) return 'open';
  return 'private';
}

/** Onglet actif : la page elle-même ou une sous-page (/orders/new active « Ordres »). */
export function isActiveTab(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

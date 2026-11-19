import type { Metadata } from 'next';

/**
 * Titre d'onglet d'une section, posé par un layout de passage (le modèle « %s · Bourse Tracker »
 * du layout racine s'y applique) : chaque onglet ouvert se distingue des autres.
 */
export const pageTitle = (title: string): Metadata => ({ title });

export function PassThrough({ children }: { children: React.ReactNode }) {
  return children;
}

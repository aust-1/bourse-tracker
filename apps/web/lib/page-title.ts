import type { Metadata } from 'next';

/** Titre de l'onglet du navigateur : la page d'abord, pour distinguer plusieurs onglets ouverts. */
export const TITLE_TEMPLATE = '%s · Bourse Tracker';

/**
 * Titre d'une section, posé par un layout de passage. Le modèle est redonné à chaque niveau : un
 * titre en simple chaîne effacerait celui du parent pour les pages en dessous (resolveTitle de Next).
 */
export const pageTitle = (title: string): Metadata => ({
  title: { default: title, template: TITLE_TEMPLATE },
});

export function PassThrough({ children }: { children: React.ReactNode }) {
  return children;
}

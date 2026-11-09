import type { Database } from '@bourse/db';

export type PortfolioKind = Database['public']['Enums']['portfolio_kind'];

export const KIND_LABELS: Record<PortfolioKind, string> = {
  pea: 'PEA',
  pea_pme: 'PEA-PME',
  cto: 'Compte-titres',
};

import type { AlertType } from './types';

const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const pctFmt = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

export const fmtEur = (n: number) => eurFmt.format(n);
export const fmtPct = (n: number) => `${pctFmt.format(n)} %`;

/** Phrase décrivant la condition d'une alerte (seuil signé, comme stocké en base). */
export function describeCondition(type: AlertType, threshold: number): string {
  switch (type) {
    case 'price_above':
      return `cours ≥ ${fmtEur(threshold)}`;
    case 'price_below':
      return `cours ≤ ${fmtEur(threshold)}`;
    case 'day_change_up':
      return `variation du jour ≥ ${fmtPct(threshold)}`;
    case 'day_change_down':
      return `variation du jour ≤ ${fmtPct(threshold)}`;
    case 'position_pl_above':
      return `gain sur ma position ≥ ${fmtPct(threshold)}`;
    case 'position_pl_below':
      return `gain sur ma position ≤ ${fmtPct(threshold)}`;
    case 'drawdown_from_high':
      return `baisse depuis le plus haut ≤ ${fmtPct(threshold)}`;
    case 'portfolio_value_above':
      return `valeur du portefeuille ≥ ${fmtEur(threshold)}`;
    case 'portfolio_value_below':
      return `valeur du portefeuille ≤ ${fmtEur(threshold)}`;
    case 'portfolio_day_change_up':
      return `variation du jour du portefeuille ≥ ${fmtPct(threshold)}`;
    case 'portfolio_day_change_down':
      return `variation du jour du portefeuille ≤ ${fmtPct(threshold)}`;
  }
}

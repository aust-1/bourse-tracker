import type { AlertType } from './types';

export interface AlertRule {
  type: AlertType;
  /** Signé, comparé tel quel : *_above / *_up → valeur ≥ seuil ; les autres → valeur ≤ seuil. */
  threshold: number;
}

export interface AlertContext {
  /** Cours du titre (alertes de titre) */
  price?: number;
  /** Clôture de la veille, null si inconnue. */
  prevClose?: number | null;
  /** PRU de la position, null si aucune position. */
  avgCost?: number | null;
  /** Plus haut observé depuis la création ou le réarmement (baisse depuis le plus haut) */
  high?: number | null;
  /** Valeur du portefeuille en EUR (alertes de portefeuille) */
  portfolioValue?: number | null;
  /** Variation du jour du portefeuille en pourcents */
  portfolioDayPct?: number | null;
}

export interface AlertResult {
  triggered: boolean;
  /** Valeur mesurée : prix ou montant (EUR), ou pourcentage. null si non calculable. */
  value: number | null;
}

const ratioPct = (a: number | undefined, b: number | null | undefined) =>
  a !== undefined && b && b > 0 ? (a / b - 1) * 100 : null;

/** Valeur surveillée pour ce type d'alerte, ou null si les données manquent. */
export function alertValue(type: AlertType, ctx: AlertContext): number | null {
  switch (type) {
    case 'price_above':
    case 'price_below':
      return ctx.price ?? null;
    case 'day_change_up':
    case 'day_change_down':
      return ratioPct(ctx.price, ctx.prevClose);
    case 'position_pl_above':
    case 'position_pl_below':
      return ratioPct(ctx.price, ctx.avgCost);
    case 'drawdown_from_high':
      return ratioPct(ctx.price, ctx.high);
    case 'portfolio_value_above':
    case 'portfolio_value_below':
      return ctx.portfolioValue ?? null;
    case 'portfolio_day_change_up':
    case 'portfolio_day_change_down':
      return ctx.portfolioDayPct ?? null;
  }
}

/** Unité de la valeur mesurée : montant en euros ou pourcentage. */
export const alertUnit = (t: AlertType): 'eur' | 'pct' =>
  t.startsWith('price') || t.startsWith('portfolio_value') ? 'eur' : 'pct';

const TOLERANCE = 1e-9;

const isAbove = (t: AlertType) => t.endsWith('_above') || t.endsWith('_up');

export function evaluateAlert(rule: AlertRule, ctx: AlertContext): AlertResult {
  const value = alertValue(rule.type, ctx);
  if (value === null || !Number.isFinite(value)) return { triggered: false, value: null };
  // tolérance : évite qu'un seuil de 5 % pile rate à cause d'un arrondi flottant
  const triggered = isAbove(rule.type)
    ? value >= rule.threshold - TOLERANCE
    : value <= rule.threshold + TOLERANCE;
  return { triggered, value };
}

/** Nouveau plus haut de référence (baisse depuis le plus haut) après une cote. */
export const nextHigh = (high: number | null, price: number) =>
  high === null || price > high ? price : high;

/**
 * Une alerte déclenchée se réarme quand son délai est écoulé ET que la condition est redevenue
 * fausse : pas de rafale de notifications tant que la situation dure.
 */
export function shouldRearm(
  a: { rearmMinutes: number | null; lastTriggeredAt: string | null },
  stillTriggered: boolean,
  now: Date,
): boolean {
  if (a.rearmMinutes === null || !a.lastTriggeredAt) return false;
  const due = new Date(a.lastTriggeredAt).getTime() + a.rearmMinutes * 60_000;
  return now.getTime() >= due && !stillTriggered;
}

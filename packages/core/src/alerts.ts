import type { AlertType } from './types';

export interface AlertRule {
  type: AlertType;
  /** Signé, comparé tel quel : *_above → valeur ≥ seuil ; *_below / day_change_down → valeur ≤ seuil. */
  threshold: number;
}

export interface AlertContext {
  price: number;
  /** Clôture de la veille, null si inconnue. */
  prevClose: number | null;
  /** PRU de la position, null si aucune position. */
  avgCost: number | null;
}

export interface AlertResult {
  triggered: boolean;
  /** Valeur mesurée : prix (EUR) ou pourcentage. null si non calculable. */
  value: number | null;
}

/** Valeur surveillée pour ce type d'alerte, ou null si les données manquent. */
export function alertValue(type: AlertType, ctx: AlertContext): number | null {
  switch (type) {
    case 'price_above':
    case 'price_below':
      return ctx.price;
    case 'day_change_up':
    case 'day_change_down':
      return ctx.prevClose && ctx.prevClose > 0 ? (ctx.price / ctx.prevClose - 1) * 100 : null;
    case 'position_pl_above':
    case 'position_pl_below':
      return ctx.avgCost && ctx.avgCost > 0 ? (ctx.price / ctx.avgCost - 1) * 100 : null;
  }
}

const TOLERANCE = 1e-9;

const isAbove = (t: AlertType) =>
  t === 'price_above' || t === 'day_change_up' || t === 'position_pl_above';

export function evaluateAlert(rule: AlertRule, ctx: AlertContext): AlertResult {
  const value = alertValue(rule.type, ctx);
  if (value === null || !Number.isFinite(value)) return { triggered: false, value: null };
  // tolérance : évite qu'un seuil de 5 % pile rate à cause d'un arrondi flottant
  const triggered = isAbove(rule.type)
    ? value >= rule.threshold - TOLERANCE
    : value <= rule.threshold + TOLERANCE;
  return { triggered, value };
}

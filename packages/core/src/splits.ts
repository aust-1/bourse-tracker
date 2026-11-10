import { parisDate } from './market';
import type { Order } from './types';

/** Division (ou regroupement) : `from` anciens titres deviennent `to` nouveaux à `effectiveOn`. */
export interface Split {
  instrumentId: string;
  /** Premier jour de cotation sur la nouvelle base (Paris), YYYY-MM-DD */
  effectiveOn: string;
  from: number;
  to: number;
}

/** Facteur de quantité d'un ordre exécuté à `at` : produit des splits postérieurs. */
export function splitFactor(splits: readonly Split[], at: string | Date): number {
  const day = parisDate(at);
  return splits.reduce((f, s) => (s.effectiveOn > day ? (f * s.to) / s.from : f), 1);
}

/**
 * Convertit des ordres en titres « d'après » les splits (quantité × facteur, prix ÷ facteur) :
 * montants inchangés, cohérents avec les cours ajustés de Yahoo. `splits` : ceux de l'instrument.
 */
export function adjustForSplits<T extends Order>(
  orders: readonly T[],
  splits: readonly Split[],
): T[] {
  if (splits.length === 0) return [...orders];
  return orders.map((o) => {
    const f = splitFactor(splits, o.executedAt);
    return f === 1 ? o : { ...o, quantity: o.quantity * f, unitPrice: o.unitPrice / f };
  });
}

/** Applique à chaque ordre les splits de son instrument. */
export function adjustOrdersBySplits<T extends Order & { instrumentId: string }>(
  orders: readonly T[],
  splits: readonly Split[],
): T[] {
  if (splits.length === 0) return [...orders];
  const byInstrument = new Map<string, Split[]>();
  for (const s of splits) {
    byInstrument.set(s.instrumentId, [...(byInstrument.get(s.instrumentId) ?? []), s]);
  }
  return orders.map((o) => {
    const own = byInstrument.get(o.instrumentId);
    return own ? adjustForSplits([o], own)[0]! : o;
  });
}

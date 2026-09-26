export type Side = 'buy' | 'sell';

/** Ordre exécuté. `executedAt` : ISO 8601 (avec fuseau) ou Date. Montants en EUR. */
export interface Order {
  id: string;
  side: Side;
  quantity: number;
  unitPrice: number;
  fees: number;
  executedAt: string | Date;
}

export interface Position {
  quantity: number;
  /** Prix de revient unitaire (PMP), frais d'achat inclus. 0 si aucune position. */
  avgCost: number;
  /** quantity × avgCost */
  costBasis: number;
  /** Plus-value réalisée cumulée (ventes, frais de vente déduits). */
  realizedPl: number;
}

export type AlertType =
  | 'price_above'
  | 'price_below'
  | 'day_change_up'
  | 'day_change_down'
  | 'position_pl_above'
  | 'position_pl_below';

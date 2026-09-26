import { parisDate } from './market';
import { applyOrder, EMPTY_POSITION, sortOrders } from './positions';
import type { Order } from './types';

export interface InstrumentHistory {
  orders: readonly Order[];
  /** Clôtures journalières triées par date croissante. */
  closes: readonly { date: string; close: number }[];
}

export interface Snapshot {
  date: string;
  marketValue: number;
  costBasis: number;
  realizedPl: number;
  /** Apports nets cumulés : achats (frais inclus) moins produit net des ventes. */
  netContributions: number;
}

/**
 * Reconstruit la courbe du portefeuille pour chaque date de `dates` (YYYY-MM-DD, croissantes).
 * Un ordre exécuté le jour D compte dans le snapshot du jour D (date parisienne).
 * Valeur d'une ligne = quantité × dernière clôture connue ≤ date ; sans clôture connue,
 * on retient le prix de revient (valeur = coût).
 */
export function buildSnapshots(
  instruments: readonly InstrumentHistory[],
  dates: readonly string[],
): Snapshot[] {
  const states = instruments.map((inst) => ({
    orders: sortOrders(inst.orders),
    closes: inst.closes,
    oi: 0,
    ci: 0,
    pos: EMPTY_POSITION,
    lastClose: null as number | null,
    flow: 0,
  }));

  return dates.map((date) => {
    let marketValue = 0;
    let costBasis = 0;
    let realizedPl = 0;
    let netContributions = 0;

    for (const s of states) {
      while (s.oi < s.orders.length && parisDate(s.orders[s.oi]!.executedAt) <= date) {
        const o = s.orders[s.oi]!;
        s.pos = applyOrder(s.pos, o);
        s.flow +=
          o.side === 'buy'
            ? o.quantity * o.unitPrice + o.fees
            : -(o.quantity * o.unitPrice - o.fees);
        s.oi++;
      }
      while (s.ci < s.closes.length && s.closes[s.ci]!.date <= date) {
        s.lastClose = s.closes[s.ci]!.close;
        s.ci++;
      }
      marketValue += s.pos.quantity * (s.lastClose ?? s.pos.avgCost);
      costBasis += s.pos.costBasis;
      realizedPl += s.pos.realizedPl;
      netContributions += s.flow;
    }
    return { date, marketValue, costBasis, realizedPl, netContributions };
  });
}

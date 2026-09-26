import { parisDayStart } from './market';
import { sortOrders } from './positions';
import type { Order, Position } from './types';

export interface Valuation {
  marketValue: number;
  /** Gain latent en EUR : (cours − PRU) × quantité */
  unrealizedPl: number;
  /** En pourcents (5 = 5 %) : cours / PRU − 1. null sans position. */
  unrealizedPlPct: number | null;
  /** En pourcents : cours / clôture veille − 1. null si la veille est inconnue. */
  dayChangePct: number | null;
}

export function valuePosition(pos: Position, price: number, prevClose: number | null): Valuation {
  return {
    marketValue: pos.quantity * price,
    unrealizedPl: pos.quantity * price - pos.costBasis,
    unrealizedPlPct: pos.quantity > 0 && pos.avgCost > 0 ? (price / pos.avgCost - 1) * 100 : null,
    dayChangePct: prevClose && prevClose > 0 ? (price / prevClose - 1) * 100 : null,
  };
}

function nextDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Gain du jour en EUR pour un instrument, en tenant compte des ordres passés ce jour-là :
 * - titres détenus à la clôture de la veille : (cours − clôture veille) × quantité ;
 * - vente : consomme d'abord les titres de la veille, à (prix de vente − clôture veille) ;
 *   le reste vient d'achats du jour, à (prix de vente − cours) en correction du gain déjà compté ;
 * - achat du jour : (cours − prix d'achat) × quantité.
 * Les frais sont exclus (ils figurent dans le PRU et la plus-value réalisée).
 * `day` = date parisienne YYYY-MM-DD.
 */
export function dayPl(
  orders: readonly Order[],
  day: string,
  price: number,
  prevClose: number,
): number {
  const start = parisDayStart(day).getTime();
  const end = parisDayStart(nextDay(day)).getTime();

  let openLeft = 0; // titres détenus à la clôture de la veille, pas encore vendus aujourd'hui
  let pl = 0;

  for (const o of sortOrders(orders)) {
    const t = new Date(o.executedAt).getTime();
    if (t < start) {
      openLeft += o.side === 'buy' ? o.quantity : -o.quantity;
    } else if (t < end) {
      if (o.side === 'buy') {
        pl += o.quantity * (price - o.unitPrice);
      } else {
        const fromOpen = Math.min(openLeft, o.quantity);
        pl += fromOpen * (o.unitPrice - prevClose);
        pl += (o.quantity - fromOpen) * (o.unitPrice - price);
        openLeft -= fromOpen;
      }
    }
  }
  return pl + openLeft * (price - prevClose);
}

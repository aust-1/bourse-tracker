import type { Order, Position } from './types';

export class OversellError extends Error {
  constructor(public readonly orderId: string) {
    super(`Vente à découvert interdite (ordre ${orderId})`);
    this.name = 'OversellError';
  }
}

const time = (o: Order) => new Date(o.executedAt).getTime();

/** Ordre de rejeu : date, puis achats avant ventes, puis id (identique au trigger SQL). */
export function sortOrders<T extends Order>(orders: readonly T[]): T[] {
  return [...orders].sort((a, b) => {
    const dt = time(a) - time(b);
    if (dt !== 0) return dt;
    if (a.side !== b.side) return a.side === 'buy' ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

const EPSILON = 1e-9;

export const EMPTY_POSITION: Position = { quantity: 0, avgCost: 0, costBasis: 0, realizedPl: 0 };

/** Applique un ordre à une position (les ordres doivent arriver dans l'ordre de `sortOrders`). */
export function applyOrder(pos: Position, o: Order): Position {
  let { quantity, avgCost, realizedPl } = pos;
  if (o.side === 'buy') {
    const cost = quantity * avgCost + o.quantity * o.unitPrice + o.fees;
    quantity += o.quantity;
    avgCost = cost / quantity;
  } else {
    if (o.quantity > quantity + EPSILON) throw new OversellError(o.id);
    realizedPl += o.unitPrice * o.quantity - o.fees - avgCost * o.quantity;
    quantity -= o.quantity;
    if (quantity < EPSILON) {
      quantity = 0;
      avgCost = 0;
    }
  }
  return { quantity, avgCost, costBasis: quantity * avgCost, realizedPl };
}

/** Rejoue les ordres d'un instrument (méthode du prix moyen pondéré). */
export function computePosition(orders: readonly Order[]): Position {
  return sortOrders(orders).reduce(applyOrder, EMPTY_POSITION);
}

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

/** Ordre rattaché à un portefeuille (absent : un seul portefeuille). */
export type PortfolioOrder = Order & { portfolioId?: string | null };

/** Ordres regroupés par portefeuille : chaque enveloppe est rejouée séparément. */
export function byPortfolio<T extends PortfolioOrder>(orders: readonly T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const o of orders) {
    const key = o.portfolioId ?? '';
    const list = groups.get(key);
    if (list) list.push(o);
    else groups.set(key, [o]);
  }
  return [...groups.values()];
}

/** Somme de positions d'un même titre (une par portefeuille) : PRU = coût total / quantité. */
export function combinePositions(positions: readonly Position[]): Position {
  let quantity = 0;
  let costBasis = 0;
  let realizedPl = 0;
  for (const p of positions) {
    quantity += p.quantity;
    costBasis += p.costBasis;
    realizedPl += p.realizedPl;
  }
  if (quantity < EPSILON) return { ...EMPTY_POSITION, realizedPl };
  return { quantity, avgCost: costBasis / quantity, costBasis, realizedPl };
}

/**
 * Position d'un titre détenu dans un ou plusieurs portefeuilles : chaque enveloppe est rejouée
 * à part (le prix moyen d'un PEA ne se mélange pas à celui d'un compte-titres, comme le contrôle
 * de vente à découvert de la base), puis les positions sont additionnées.
 */
export function computePositionByPortfolio(orders: readonly PortfolioOrder[]): Position {
  return combinePositions(byPortfolio(orders).map(computePosition));
}

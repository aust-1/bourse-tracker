import { parisDayStart } from '@bourse/core';

export const PAGE_SIZE = 50;

interface Row {
  side: 'buy' | 'sell';
  quantity: number;
  unit_price: number;
  fees: number;
}

/** Montant frais compris : coût total d'un achat, produit net d'une vente. */
export const netAmount = (o: Row) =>
  o.side === 'buy' ? o.quantity * o.unit_price + o.fees : o.quantity * o.unit_price - o.fees;

export interface SelectionTotals {
  count: number;
  /** Achats, frais compris */
  bought: number;
  /** Ventes, nettes de frais */
  sold: number;
  fees: number;
}

export function selectionTotals(orders: readonly Row[]): SelectionTotals {
  const t: SelectionTotals = { count: orders.length, bought: 0, sold: 0, fees: 0 };
  for (const o of orders) {
    if (o.side === 'buy') t.bought += netAmount(o);
    else t.sold += netAmount(o);
    t.fees += o.fees;
  }
  return t;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface OrderFilters {
  instrument: string | null;
  side: 'buy' | 'sell' | null;
  /** Bornes incluses (jours de Paris) */
  from: string | null;
  to: string | null;
  page: number;
}

export function parseFilters(p: Record<string, string | undefined>): OrderFilters {
  const page = Number(p.page);
  return {
    instrument: p.instrument || null,
    side: p.side === 'buy' || p.side === 'sell' ? p.side : null,
    from: p.from && DAY.test(p.from) ? p.from : null,
    to: p.to && DAY.test(p.to) ? p.to : null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** Bornes UTC des dates de Paris : [début du jour `from`, début du lendemain de `to`). */
export function dateBounds(f: Pick<OrderFilters, 'from' | 'to'>): {
  gte: string | null;
  lt: string | null;
} {
  let lt: string | null = null;
  if (f.to) {
    const next = new Date(`${f.to}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    lt = parisDayStart(next.toISOString().slice(0, 10)).toISOString();
  }
  return { gte: f.from ? parisDayStart(f.from).toISOString() : null, lt };
}

/** Lien vers une page en gardant les filtres. */
export function pageHref(f: OrderFilters, page: number): string {
  const q = new URLSearchParams();
  if (f.instrument) q.set('instrument', f.instrument);
  if (f.side) q.set('side', f.side);
  if (f.from) q.set('from', f.from);
  if (f.to) q.set('to', f.to);
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `/orders?${s}` : '/orders';
}

import { cashEffect, type CashMovement } from './cash';
import { parisDate } from './market';
import type { Snapshot } from './portfolio';
import type { Order } from './types';

type Movement = Pick<CashMovement, 'kind' | 'amount' | 'occurredOn'>;

/** Liquidités suivies : au moins un versement enregistré (sinon le solde ne veut rien dire). */
export const tracksCash = (movements: readonly Movement[]) =>
  movements.some((m) => m.kind === 'deposit');

/**
 * Courbe de la valeur **totale** (titres + liquidités) : un achat payé avec l'argent déjà versé
 * ne change plus la valeur, seuls les versements et retraits sont des apports. Le gain
 * (valeur − apports) comprend alors dividendes et frais, déjà passés par les liquidités.
 * Les snapshots viennent de `buildSnapshots` (titres seuls).
 */
export function withCash(
  snaps: readonly Snapshot[],
  orders: readonly Pick<Order, 'side' | 'quantity' | 'unitPrice' | 'fees' | 'executedAt'>[],
  movements: readonly Movement[],
): Snapshot[] {
  const flows = [
    ...movements.map((m) => ({
      date: m.occurredOn,
      cash: cashEffect(m),
      external: m.kind === 'deposit' ? m.amount : m.kind === 'withdrawal' ? -m.amount : 0,
    })),
    ...orders.map((o) => ({
      date: parisDate(o.executedAt),
      cash:
        o.side === 'buy' ? -(o.quantity * o.unitPrice + o.fees) : o.quantity * o.unitPrice - o.fees,
      external: 0,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let i = 0;
  let cash = 0;
  let external = 0;
  return snaps.map((s) => {
    while (i < flows.length && flows[i]!.date <= s.date) {
      cash += flows[i]!.cash;
      external += flows[i]!.external;
      i++;
    }
    return { ...s, marketValue: s.marketValue + cash, netContributions: external };
  });
}

/**
 * Variation du jour rapportée à la valeur totale de la veille (titres + liquidités) : sans les
 * liquidités, un achat du jour gonflait la base comme s'il avait été détenu la veille.
 * Veille ≈ titres − gain du jour + liquidités − versements nets du jour (les achats du jour sont
 * déjà sortis des liquidités). En pourcents ; null si la base n'est pas positive.
 */
export function dayChangePctOnTotal(i: {
  marketValue: number;
  dayPl: number;
  cashBalance: number;
  netDepositsToday: number;
}): number | null {
  const base = i.marketValue - i.dayPl + i.cashBalance - i.netDepositsToday;
  return base > 0 ? (i.dayPl / base) * 100 : null;
}

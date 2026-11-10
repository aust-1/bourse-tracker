import type { Order } from './types';

export type CashKind = 'deposit' | 'withdrawal' | 'dividend' | 'fee';

/** Mouvement d'espèces d'un portefeuille. `amount` est positif ; le sens vient du type. */
export interface CashMovement {
  id: string;
  kind: CashKind;
  amount: number;
  /** Date (Paris) YYYY-MM-DD */
  occurredOn: string;
  /** Titre à l'origine d'un dividende */
  instrumentId: string | null;
}

/** Effet d'un mouvement sur les liquidités (signé). */
export function cashEffect(m: Pick<CashMovement, 'kind' | 'amount'>): number {
  return m.kind === 'deposit' || m.kind === 'dividend' ? m.amount : -m.amount;
}

export interface CashSummary {
  /** Versements cumulés */
  deposits: number;
  withdrawals: number;
  dividends: number;
  fees: number;
  /** Achats (frais inclus) moins produit net des ventes */
  netInvested: number;
  /** Solde : versements − retraits + dividendes − frais − achats + ventes */
  balance: number;
}

export function summarizeCash(
  orders: readonly Pick<Order, 'side' | 'quantity' | 'unitPrice' | 'fees'>[],
  movements: readonly Pick<CashMovement, 'kind' | 'amount'>[],
): CashSummary {
  const sum = (k: CashKind) =>
    movements.filter((m) => m.kind === k).reduce((s, m) => s + m.amount, 0);
  const netInvested = orders.reduce(
    (s, o) =>
      s +
      (o.side === 'buy' ? o.quantity * o.unitPrice + o.fees : -(o.quantity * o.unitPrice - o.fees)),
    0,
  );
  const deposits = sum('deposit');
  const withdrawals = sum('withdrawal');
  const dividends = sum('dividend');
  const fees = sum('fee');
  return {
    deposits,
    withdrawals,
    dividends,
    fees,
    netInvested,
    balance: deposits - withdrawals + dividends - fees - netInvested,
  };
}

/** Plafond des versements sur un PEA classique. */
export const PEA_CAP = 150_000;
/** Plafond commun PEA + PEA-PME (le PEA-PME seul peut aller jusque-là si le PEA est vide). */
export const PEA_PME_COMBINED_CAP = 225_000;

export interface CapStatus {
  cap: number;
  used: number;
  remaining: number;
  /** En pourcents */
  usedPct: number;
}

const status = (cap: number, used: number): CapStatus => ({
  cap,
  used,
  remaining: Math.max(0, cap - used),
  usedPct: (used / cap) * 100,
});

/**
 * Plafonds de versements : PEA (150 000 €) et ensemble PEA + PEA-PME (225 000 €). On compte les
 * versements cumulés ; les retraits ne reconstituent pas le plafond.
 */
export function capStatus(depositsByKind: { pea: number; pea_pme: number }): {
  pea: CapStatus;
  combined: CapStatus;
} {
  return {
    pea: status(PEA_CAP, depositsByKind.pea),
    combined: status(PEA_PME_COMBINED_CAP, depositsByKind.pea + depositsByKind.pea_pme),
  };
}

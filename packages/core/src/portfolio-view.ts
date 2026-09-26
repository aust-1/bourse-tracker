import { isMarketOpen, parisDate } from './market';
import { computePosition } from './positions';
import type { Order } from './types';
import { dayPl, valuePosition } from './valuation';

export interface InstrumentRow {
  id: string;
  symbol: string;
  name: string;
}

export interface OrderRow extends Order {
  instrumentId: string;
}

export interface QuoteRow {
  instrumentId: string;
  price: number;
  prevClose: number | null;
  quotedAt: string;
  fetchedAt: string;
}

export interface PositionRow {
  instrumentId: string;
  symbol: string;
  name: string;
  quantity: number;
  avgCost: number;
  costBasis: number;
  quote: QuoteRow | null;
  marketValue: number | null;
  unrealizedPl: number | null;
  unrealizedPlPct: number | null;
  dayChangePct: number | null;
  dayPl: number | null;
}

export interface PortfolioTotals {
  /** Valeur de marché ; une ligne sans cote est retenue à son prix de revient. */
  marketValue: number;
  costBasis: number;
  unrealizedPl: number;
  unrealizedPlPct: number | null;
  dayPl: number;
  dayPlPct: number | null;
  realizedPl: number;
  /** Nombre de lignes sans cote (totaux incomplets si > 0). */
  missingQuotes: number;
  /** Date (Paris) de la séance des dernières cotes. */
  sessionDate: string | null;
}

export interface PortfolioView {
  rows: PositionRow[];
  totals: PortfolioTotals;
}

export function buildPortfolioView(
  orders: readonly OrderRow[],
  instruments: readonly InstrumentRow[],
  quotes: ReadonlyMap<string, QuoteRow>,
): PortfolioView {
  const rows: PositionRow[] = [];
  let realizedPl = 0;
  let totalValue = 0;
  let totalCost = 0;
  let totalDayPl = 0;
  let missingQuotes = 0;
  let latestQuote: number | null = null;

  for (const inst of instruments) {
    const own = orders.filter((o) => o.instrumentId === inst.id);
    if (own.length === 0) continue;
    const pos = computePosition(own);
    realizedPl += pos.realizedPl;
    if (pos.quantity === 0) continue;

    const quote = quotes.get(inst.id) ?? null;
    const base = { instrumentId: inst.id, symbol: inst.symbol, name: inst.name };

    if (!quote) {
      missingQuotes++;
      totalValue += pos.costBasis;
      totalCost += pos.costBasis;
      rows.push({
        ...base,
        quantity: pos.quantity,
        avgCost: pos.avgCost,
        costBasis: pos.costBasis,
        quote: null,
        marketValue: null,
        unrealizedPl: null,
        unrealizedPlPct: null,
        dayChangePct: null,
        dayPl: null,
      });
      continue;
    }

    const v = valuePosition(pos, quote.price, quote.prevClose);
    const day =
      quote.prevClose !== null
        ? dayPl(own, parisDate(quote.quotedAt), quote.price, quote.prevClose)
        : null;
    totalValue += v.marketValue;
    totalCost += pos.costBasis;
    totalDayPl += day ?? 0;
    const t = new Date(quote.quotedAt).getTime();
    if (latestQuote === null || t > latestQuote) latestQuote = t;

    rows.push({
      ...base,
      quantity: pos.quantity,
      avgCost: pos.avgCost,
      costBasis: pos.costBasis,
      quote,
      marketValue: v.marketValue,
      unrealizedPl: v.unrealizedPl,
      unrealizedPlPct: v.unrealizedPlPct,
      dayChangePct: v.dayChangePct,
      dayPl: day,
    });
  }

  rows.sort((a, b) => (b.marketValue ?? b.costBasis) - (a.marketValue ?? a.costBasis));
  const dayBase = totalValue - totalDayPl;

  return {
    rows,
    totals: {
      marketValue: totalValue,
      costBasis: totalCost,
      unrealizedPl: totalValue - totalCost,
      unrealizedPlPct: totalCost > 0 ? (totalValue / totalCost - 1) * 100 : null,
      dayPl: totalDayPl,
      dayPlPct: dayBase > 0 ? (totalDayPl / dayBase) * 100 : null,
      realizedPl,
      missingQuotes,
      sessionDate: latestQuote === null ? null : parisDate(new Date(latestQuote)),
    },
  };
}

export type Freshness =
  { kind: 'live' } | { kind: 'delayed'; minutes: number } | { kind: 'closed'; at: string };

/** État d'une cote : en direct, différée (séance ouverte mais cote ancienne) ou clôturée. */
export function quoteFreshness(quotedAt: string, now: Date, toleranceMs = 120_000): Freshness {
  if (!isMarketOpen(now)) return { kind: 'closed', at: quotedAt };
  const lag = now.getTime() - new Date(quotedAt).getTime();
  if (lag <= toleranceMs) return { kind: 'live' };
  return { kind: 'delayed', minutes: Math.round(lag / 60_000) };
}

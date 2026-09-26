import { buildSnapshots, parisDate, type Snapshot } from '@bourse/core';
import { fetchAll, type Database } from '@bourse/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderRow, QuoteRow } from '@bourse/core';

export const RANGES = [
  { key: '1m', label: '1 M' },
  { key: '3m', label: '3 M' },
  { key: 'ytd', label: 'Depuis janv.' },
  { key: '1y', label: '1 A' },
  { key: 'all', label: 'Tout' },
] as const;
export type RangeKey = (typeof RANGES)[number]['key'];

export const isRangeKey = (v: string | undefined): v is RangeKey => RANGES.some((r) => r.key === v);

export interface CloseRow {
  instrumentId: string;
  date: string;
  close: number;
}

/**
 * Courbe du portefeuille : valeur, coût et apports à la clôture de chaque séance depuis le
 * premier ordre. La cote en direct complète la dernière clôture connue (séance en cours).
 */
export function buildHistory(
  orders: readonly OrderRow[],
  closes: readonly CloseRow[],
  quotes: readonly QuoteRow[],
): Snapshot[] {
  if (orders.length === 0) return [];

  const byInstrument = new Map<string, { date: string; close: number }[]>();
  for (const c of closes) {
    const list = byInstrument.get(c.instrumentId) ?? [];
    list.push({ date: c.date, close: c.close });
    byInstrument.set(c.instrumentId, list);
  }
  for (const list of byInstrument.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  // cote en direct : ajoutée uniquement si la séance n'a pas encore de clôture enregistrée
  for (const q of quotes) {
    const list = byInstrument.get(q.instrumentId) ?? [];
    const day = parisDate(q.quotedAt);
    if (!list.some((c) => c.date === day)) {
      list.push({ date: day, close: q.price });
      list.sort((a, b) => a.date.localeCompare(b.date));
    }
    byInstrument.set(q.instrumentId, list);
  }

  const ordersByInstrument = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const list = ordersByInstrument.get(o.instrumentId) ?? [];
    list.push(o);
    ordersByInstrument.set(o.instrumentId, list);
  }

  const firstOrder = orders.map((o) => parisDate(o.executedAt)).reduce((a, b) => (a < b ? a : b));
  const dates = [...new Set([...byInstrument.values()].flatMap((l) => l.map((c) => c.date)))]
    .filter((d) => d >= firstOrder)
    .sort();

  return buildSnapshots(
    [...ordersByInstrument].map(([id, list]) => ({
      orders: list,
      closes: byInstrument.get(id) ?? [],
    })),
    dates,
  );
}

export interface PeriodStats {
  /** Points affichés sur la période */
  points: Snapshot[];
  end: Snapshot;
  /** Gain hors apports sur la période : variation de valeur moins capitaux ajoutés ou retirés. */
  gain: number;
  /** Gain rapporté à la valeur de départ + apports de la période ; null si base nulle. */
  gainPct: number | null;
  /** Apports nets de la période (achats moins ventes) */
  contributions: number;
}

function shiftMonths(day: string, months: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export function rangeStart(range: RangeKey, today: string): string | null {
  switch (range) {
    case '1m':
      return shiftMonths(today, 1);
    case '3m':
      return shiftMonths(today, 3);
    case '1y':
      return shiftMonths(today, 12);
    case 'ytd':
      return `${today.slice(0, 4)}-01-01`;
    case 'all':
      return null;
  }
}

export function periodStats(
  snaps: readonly Snapshot[],
  range: RangeKey,
  today: string,
): PeriodStats | null {
  if (snaps.length === 0) return null;
  const start = rangeStart(range, today);
  const points = start ? snaps.filter((s) => s.date >= start) : [...snaps];
  if (points.length === 0) return null;

  // base : dernière clôture strictement avant le début de la période
  const base = start ? ([...snaps].reverse().find((s) => s.date < start) ?? null) : null;
  const end = points[points.length - 1]!;
  const baseValue = base ? base.marketValue : 0;
  const baseContrib = base ? base.netContributions : 0;

  const contributions = end.netContributions - baseContrib;
  const gain = end.marketValue - baseValue - contributions;
  const capital = baseValue + contributions;
  return { points, end, gain, gainPct: capital > 0 ? (gain / capital) * 100 : null, contributions };
}

type Client = SupabaseClient<Database>;

export async function loadCloses(
  supabase: Client,
  instrumentIds: readonly string[],
): Promise<CloseRow[]> {
  if (instrumentIds.length === 0) return [];
  const rows = await fetchAll((from, to) =>
    supabase
      .from('price_history')
      .select('instrument_id, date, close')
      .in('instrument_id', [...instrumentIds])
      .order('instrument_id')
      .order('date')
      .range(from, to),
  );
  return rows.map((r) => ({ instrumentId: r.instrument_id, date: r.date, close: r.close }));
}

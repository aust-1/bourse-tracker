import type { Database } from '@bourse/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Store, StoredQuote, TrackedInstrument } from './store';

export type Db = SupabaseClient<Database>;

export function must<T>(
  res: { data: T | null; error: { message: string } | null },
  what: string,
): T {
  if (res.error) throw new Error(`${what} : ${res.error.message}`);
  return res.data as T;
}

export class SupabaseStore implements Store {
  constructor(readonly db: Db) {}

  async listTrackedInstruments(): Promise<TrackedInstrument[]> {
    const [orders, alerts] = await Promise.all([
      this.db.from('orders').select('instrument_id'),
      this.db.from('alerts').select('instrument_id').eq('status', 'active'),
    ]);
    const ids = new Set([
      ...must(orders, 'lecture des ordres').map((o) => o.instrument_id),
      ...must(alerts, 'lecture des alertes').map((a) => a.instrument_id),
    ]);
    if (ids.size === 0) return [];
    const rows = must(
      await this.db
        .from('instruments')
        .select('id, yahoo_symbol, name')
        .in('id', [...ids]),
      'lecture des instruments',
    );
    return rows.map((r) => ({ id: r.id, symbol: r.yahoo_symbol, name: r.name }));
  }

  async getQuotes(ids: readonly string[]): Promise<Map<string, StoredQuote>> {
    if (ids.length === 0) return new Map();
    const rows = must(
      await this.db
        .from('quotes_latest')
        .select('*')
        .in('instrument_id', [...ids]),
      'lecture des cotes',
    );
    return new Map(
      rows.map((r) => [
        r.instrument_id,
        {
          instrumentId: r.instrument_id,
          price: r.price,
          prevClose: r.prev_close,
          quotedAt: new Date(r.quoted_at),
          fetchedAt: new Date(r.fetched_at),
        },
      ]),
    );
  }

  async upsertQuote(q: Omit<StoredQuote, 'fetchedAt'>): Promise<void> {
    const { error } = await this.db.from('quotes_latest').upsert({
      instrument_id: q.instrumentId,
      price: q.price,
      prev_close: q.prevClose,
      quoted_at: q.quotedAt.toISOString(),
      fetched_at: new Date().toISOString(),
    });
    if (error) throw new Error(`écriture de la cote : ${error.message}`);
  }

  async getPrevCloseFallback(instrumentId: string, beforeDate: string): Promise<number | null> {
    const rows = must(
      await this.db
        .from('price_history')
        .select('close')
        .eq('instrument_id', instrumentId)
        .lt('date', beforeDate)
        .order('date', { ascending: false })
        .limit(1),
      "lecture de l'historique",
    );
    return rows[0]?.close ?? null;
  }

  async recordCycle(result: { error: string | null }): Promise<void> {
    const { error } = await this.db
      .from('worker_status')
      .update({ last_cycle_at: new Date().toISOString(), last_error: result.error })
      .eq('id', 1);
    if (error) throw new Error(`worker_status : ${error.message}`);
  }
}

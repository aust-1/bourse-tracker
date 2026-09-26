import { parisDate, type Order } from '@bourse/core';
import type { Database } from '@bourse/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AlertRow, Store, StoredQuote, TrackedInstrument, UserSettings } from './store';

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

  async getHistoryBounds(instrumentId: string) {
    const [lo, hi] = await Promise.all([
      this.db
        .from('price_history')
        .select('date')
        .eq('instrument_id', instrumentId)
        .order('date', { ascending: true })
        .limit(1),
      this.db
        .from('price_history')
        .select('date')
        .eq('instrument_id', instrumentId)
        .order('date', { ascending: false })
        .limit(1),
    ]);
    return {
      min: must(lo, "lecture de l'historique")[0]?.date ?? null,
      max: must(hi, "lecture de l'historique")[0]?.date ?? null,
    };
  }

  async getFirstOrderDate(instrumentId: string): Promise<string | null> {
    const rows = must(
      await this.db
        .from('orders')
        .select('executed_at')
        .eq('instrument_id', instrumentId)
        .order('executed_at', { ascending: true })
        .limit(1),
      'lecture du premier ordre',
    );
    return rows[0] ? parisDate(rows[0].executed_at) : null;
  }

  async upsertCloses(
    rows: readonly { instrumentId: string; date: string; close: number }[],
  ): Promise<void> {
    // par lots : l'historique complet d'un ETF ancien dépasse 4 000 lignes
    for (let i = 0; i < rows.length; i += 1000) {
      const batch = rows.slice(i, i + 1000).map((r) => ({
        instrument_id: r.instrumentId,
        date: r.date,
        close: r.close,
      }));
      const { error } = await this.db.from('price_history').upsert(batch);
      if (error) throw new Error(`écriture de l'historique : ${error.message}`);
    }
  }

  async listActiveAlerts(): Promise<AlertRow[]> {
    const rows = must(
      await this.db
        .from('alerts')
        .select('id, user_id, instrument_id, type, threshold, channels')
        .eq('status', 'active'),
      'lecture des alertes actives',
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      instrumentId: r.instrument_id,
      type: r.type,
      threshold: r.threshold,
      channels: r.channels,
    }));
  }

  async getOrders(userId: string, instrumentId: string): Promise<Order[]> {
    const rows = must(
      await this.db
        .from('orders')
        .select('id, side, quantity, unit_price, fees, executed_at')
        .eq('user_id', userId)
        .eq('instrument_id', instrumentId),
      'lecture des ordres',
    );
    return rows.map((o) => ({
      id: o.id,
      side: o.side,
      quantity: o.quantity,
      unitPrice: o.unit_price,
      fees: o.fees,
      executedAt: o.executed_at,
    }));
  }

  async claimAlert(alertId: string, at: Date): Promise<boolean> {
    // le filtre sur status = 'active' rend la prise atomique : un seul cycle gagne
    const rows = must(
      await this.db
        .from('alerts')
        .update({ status: 'triggered', last_triggered_at: at.toISOString() })
        .eq('id', alertId)
        .eq('status', 'active')
        .select('id'),
      "prise de l'alerte",
    );
    return rows.length === 1;
  }

  async releaseAlert(alertId: string): Promise<void> {
    const { error } = await this.db.from('alerts').update({ status: 'active' }).eq('id', alertId);
    if (error) throw new Error(`remise en active de l'alerte : ${error.message}`);
  }

  async recordAlertEvent(e: {
    alertId: string;
    userId: string;
    value: number;
    delivery: Record<string, string>;
  }): Promise<void> {
    const { error } = await this.db.from('alert_events').insert({
      alert_id: e.alertId,
      user_id: e.userId,
      value_at_trigger: e.value,
      delivery: e.delivery,
    });
    if (error) throw new Error(`historique d'alerte : ${error.message}`);
  }

  private toSettings(r: Database['public']['Tables']['settings']['Row']): UserSettings {
    return {
      userId: r.user_id,
      discordWebhookUrl: r.discord_webhook_url,
      email: r.email,
      summaryEnabled: r.summary_enabled,
      summaryTime: r.summary_time,
      lastSummaryOn: r.last_summary_on,
    };
  }

  async getSettings(userId: string): Promise<UserSettings | null> {
    const { data, error } = await this.db
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`lecture des réglages : ${error.message}`);
    return data ? this.toSettings(data) : null;
  }

  async listSettings(): Promise<UserSettings[]> {
    const rows = must(await this.db.from('settings').select('*'), 'lecture des réglages');
    return rows.map((r) => this.toSettings(r));
  }
}

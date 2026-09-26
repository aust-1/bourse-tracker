import type { Order } from '@bourse/core';
import type { AlertRow, Store, StoredQuote, TrackedInstrument, UserSettings } from './store';

/** Implémentation en mémoire du Store, pour les tests. */
export class MemoryStore implements Store {
  tracked: TrackedInstrument[] = [];
  quotes = new Map<string, StoredQuote>();
  closes = new Map<string, { date: string; close: number }[]>();
  cycles: { error: string | null }[] = [];
  upserts = 0;

  async listTrackedInstruments() {
    return this.tracked;
  }

  async getQuotes(ids: readonly string[]) {
    return new Map([...this.quotes].filter(([id]) => ids.includes(id)));
  }

  async upsertQuote(q: Omit<StoredQuote, 'fetchedAt'>) {
    this.upserts++;
    this.quotes.set(q.instrumentId, { ...q, fetchedAt: new Date() });
  }

  async getPrevCloseFallback(instrumentId: string, beforeDate: string) {
    const rows = (this.closes.get(instrumentId) ?? []).filter((c) => c.date < beforeDate);
    return rows.length ? rows[rows.length - 1]!.close : null;
  }

  async recordCycle(result: { error: string | null }) {
    this.cycles.push(result);
  }

  alerts: (AlertRow & { status: 'active' | 'triggered' })[] = [];
  orders: (Order & { userId: string; instrumentId: string })[] = [];
  settings: UserSettings[] = [];
  events: { alertId: string; userId: string; value: number; delivery: Record<string, string> }[] =
    [];

  async listActiveAlerts() {
    return this.alerts.filter((a) => a.status === 'active');
  }

  async getOrders(userId: string, instrumentId: string) {
    return this.orders.filter((o) => o.userId === userId && o.instrumentId === instrumentId);
  }

  async claimAlert(alertId: string) {
    const a = this.alerts.find((x) => x.id === alertId);
    if (!a || a.status !== 'active') return false;
    a.status = 'triggered';
    return true;
  }

  async releaseAlert(alertId: string) {
    const a = this.alerts.find((x) => x.id === alertId);
    if (a) a.status = 'active';
  }

  async recordAlertEvent(e: {
    alertId: string;
    userId: string;
    value: number;
    delivery: Record<string, string>;
  }) {
    this.events.push(e);
  }

  async getSettings(userId: string) {
    return this.settings.find((s) => s.userId === userId) ?? null;
  }

  async listSettings() {
    return this.settings;
  }
}

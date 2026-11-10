import type { Order } from '@bourse/core';
import type {
  AlertEventRow,
  AlertRow,
  CycleRecord,
  Store,
  StoredQuote,
  TrackedInstrument,
  UserSettings,
} from './store';

/** Implémentation en mémoire du Store, pour les tests. */
export class MemoryStore implements Store {
  tracked: TrackedInstrument[] = [];
  quotes = new Map<string, StoredQuote>();
  closes = new Map<string, { date: string; close: number }[]>();
  cycles: CycleRecord[] = [];
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

  assetTypes = new Map<string, 'etf' | 'equity'>();

  async setAssetType(instrumentId: string, type: 'etf' | 'equity') {
    if (!this.assetTypes.has(instrumentId)) this.assetTypes.set(instrumentId, type);
  }

  async getPrevCloseFallback(instrumentId: string, beforeDate: string) {
    const rows = (this.closes.get(instrumentId) ?? []).filter((c) => c.date < beforeDate);
    return rows.length ? rows[rows.length - 1]!.close : null;
  }

  async recordCycle(result: CycleRecord) {
    this.cycles.push(result);
  }

  firstOrders = new Map<string, string>();

  async getHistoryBounds(instrumentId: string) {
    const dates = (this.closes.get(instrumentId) ?? []).map((c) => c.date).sort();
    return { min: dates[0] ?? null, max: dates[dates.length - 1] ?? null };
  }

  async getFirstOrderDate(instrumentId: string) {
    return this.firstOrders.get(instrumentId) ?? null;
  }

  async upsertCloses(rows: readonly { instrumentId: string; date: string; close: number }[]) {
    for (const r of rows) {
      const list = (this.closes.get(r.instrumentId) ?? []).filter((c) => c.date !== r.date);
      list.push({ date: r.date, close: r.close });
      list.sort((a, b) => a.date.localeCompare(b.date));
      this.closes.set(r.instrumentId, list);
    }
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

  async claimAlert(alertId: string, at: Date = new Date()) {
    const a = this.alerts.find((x) => x.id === alertId);
    if (!a || a.status !== 'active') return false;
    a.status = 'triggered';
    a.lastTriggeredAt = at.toISOString();
    return true;
  }

  async listRearmableAlerts() {
    return this.alerts.filter((a) => a.status === 'triggered' && a.rearmMinutes != null);
  }

  async rearmAlert(alertId: string) {
    const a = this.alerts.find((x) => x.id === alertId);
    if (a && a.status === 'triggered') {
      a.status = 'active';
      a.referenceValue = null;
    }
  }

  async updateAlertReference(alertId: string, value: number) {
    const a = this.alerts.find((x) => x.id === alertId);
    if (a) a.referenceValue = value;
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

  admins = new Set<string>();

  async listAdminSettings() {
    return this.settings.filter((s) => this.admins.has(s.userId));
  }

  alertEvents: (AlertEventRow & { userId: string })[] = [];
  summariesSent: { userId: string; day: string }[] = [];

  async listUserOrders(userId: string) {
    return this.orders.filter((o) => o.userId === userId);
  }

  async listAlertEventsSince(userId: string, since: Date) {
    return this.alertEvents.filter((e) => e.userId === userId && e.triggeredAt >= since);
  }

  async markSummarySent(userId: string, day: string) {
    this.summariesSent.push({ userId, day });
    const s = this.settings.find((x) => x.userId === userId);
    if (s) s.lastSummaryOn = day;
  }

  reportsSent: { userId: string; day: string }[] = [];
  income = new Map<string, { date: string; amount: number }[]>();

  async markReportSent(userId: string, day: string) {
    this.reportsSent.push({ userId, day });
    const s = this.settings.find((x) => x.userId === userId);
    if (s) s.lastReportOn = day;
  }

  async getCloses(instrumentIds: readonly string[], fromDate: string) {
    return instrumentIds.flatMap((id) =>
      (this.closes.get(id) ?? [])
        .filter((c) => c.date >= fromDate)
        .map((c) => ({ instrumentId: id, date: c.date, close: c.close })),
    );
  }

  async listIncome(userId: string) {
    return this.income.get(userId) ?? [];
  }
}

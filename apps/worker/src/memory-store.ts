import type { Store, StoredQuote, TrackedInstrument } from './store';

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
}

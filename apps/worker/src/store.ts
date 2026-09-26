import type { AlertType } from '@bourse/core';

export interface TrackedInstrument {
  id: string;
  symbol: string;
  name: string;
}

export interface StoredQuote {
  instrumentId: string;
  price: number;
  prevClose: number | null;
  quotedAt: Date;
  fetchedAt: Date;
}

export interface AlertRow {
  id: string;
  userId: string;
  instrumentId: string;
  type: AlertType;
  threshold: number;
  channels: string[];
}

export interface Position {
  quantity: number;
  avgCost: number;
}

export interface UserSettings {
  userId: string;
  discordWebhookUrl: string | null;
  email: string | null;
  summaryEnabled: boolean;
  summaryTime: string;
  lastSummaryOn: string | null;
}

/** Accès aux données du worker : implémenté par Supabase (prod) et en mémoire (tests). */
export interface Store {
  /** Instruments à suivre : ceux qui ont au moins un ordre ou une alerte active. */
  listTrackedInstruments(): Promise<TrackedInstrument[]>;
  getQuotes(instrumentIds: readonly string[]): Promise<Map<string, StoredQuote>>;
  upsertQuote(q: Omit<StoredQuote, 'fetchedAt'>): Promise<void>;
  /** Dernière clôture journalière strictement avant `beforeDate` (YYYY-MM-DD). */
  getPrevCloseFallback(instrumentId: string, beforeDate: string): Promise<number | null>;
  recordCycle(result: { error: string | null }): Promise<void>;
}

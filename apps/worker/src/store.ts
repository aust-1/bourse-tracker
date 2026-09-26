import type { AlertType, Order } from '@bourse/core';

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

  /** Plus ancienne et plus récente clôture stockées pour un instrument. */
  getHistoryBounds(instrumentId: string): Promise<{ min: string | null; max: string | null }>;
  /** Date (Paris) du plus ancien ordre sur cet instrument, tous utilisateurs confondus. */
  getFirstOrderDate(instrumentId: string): Promise<string | null>;
  upsertCloses(
    rows: readonly { instrumentId: string; date: string; close: number }[],
  ): Promise<void>;

  listActiveAlerts(): Promise<AlertRow[]>;
  /** Ordres d'un utilisateur sur un instrument (pour calculer le PRU). */
  getOrders(userId: string, instrumentId: string): Promise<Order[]>;
  /** Passe l'alerte de `active` à `triggered` ; false si une autre exécution l'a déjà prise. */
  claimAlert(alertId: string, at: Date): Promise<boolean>;
  /** Remet l'alerte en `active` (échec total d'envoi : on réessaiera au prochain cycle). */
  releaseAlert(alertId: string): Promise<void>;
  recordAlertEvent(e: {
    alertId: string;
    userId: string;
    value: number;
    delivery: Record<string, string>;
  }): Promise<void>;
  getSettings(userId: string): Promise<UserSettings | null>;
  listSettings(): Promise<UserSettings[]>;
}

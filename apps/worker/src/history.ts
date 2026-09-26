import { parisDate, parisMinutes } from '@bourse/core';
import type { DailyClose, PriceProvider } from '@bourse/providers';
import type { Logger } from './log';
import type { FreshQuote } from './poll';
import type { Store } from './store';

interface Deps {
  store: Store;
  provider: Pick<PriceProvider, 'getDailyCloses'>;
  log: Logger;
}

const DAY_MS = 24 * 3600 * 1000;
/** À partir de 17:35 (Paris), la cote de l'enchère de clôture est la clôture officielle. */
const CLOSE_MINUTES = 17 * 60 + 35;
const REFRESH_AFTER_MINUTES = 18 * 60;

const isWeekday = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay();
  return d !== 0 && d !== 6;
};

export function historyRange(firstOrderDate: string, now: Date): '1mo' | '1y' | 'max' {
  const days = (now.getTime() - Date.parse(`${firstOrderDate}T00:00:00Z`)) / DAY_MS;
  return days <= 25 ? '1mo' : days <= 350 ? '1y' : 'max';
}

/**
 * Maintient `price_history` (clôtures journalières) :
 * - remplit l'historique complet d'un instrument dès qu'il a un ordre ;
 * - le rafraîchit au démarrage puis chaque soir après 18:00 ;
 * - enregistre la clôture du jour depuis la cote de fin de séance (la bougie du jour
 *   n'a pas de clôture chez Yahoo avant le lendemain).
 * La courbe du portefeuille est calculée à la demande depuis ces clôtures et les ordres.
 */
export class HistoryJob {
  /** id instrument → date du premier ordre pour laquelle un remplissage a déjà été tenté */
  private backfilled = new Map<string, string>();
  private refreshKey: string | null = null;
  private closeStored = new Set<string>();

  constructor(private readonly deps: Deps) {}

  async tick(now: Date, quotes: readonly FreshQuote[]): Promise<void> {
    await this.backfillMissing(now);
    await this.refreshRecent(now);
    await this.storeTodayClose(now, quotes);
  }

  /** Écarte la clôture du jour tant que la séance n'est pas terminée (valeur partielle). */
  private usable(rows: readonly DailyClose[], now: Date): DailyClose[] {
    const today = parisDate(now);
    const finished = parisMinutes(now) >= CLOSE_MINUTES;
    return rows.filter((r) => r.date < today || (r.date === today && finished));
  }

  private async fetchAndStore(
    instrumentId: string,
    symbol: string,
    range: '1mo' | '1y' | 'max',
    now: Date,
  ) {
    const rows = this.usable(await this.deps.provider.getDailyCloses(symbol, range), now);
    await this.deps.store.upsertCloses(
      rows.map((r) => ({ instrumentId, date: r.date, close: r.close })),
    );
    return rows.length;
  }

  private async backfillMissing(now: Date) {
    const { store, log } = this.deps;
    for (const inst of await store.listTrackedInstruments()) {
      try {
        const first = await store.getFirstOrderDate(inst.id);
        if (!first || this.backfilled.get(inst.id) === first) continue;

        const bounds = await store.getHistoryBounds(inst.id);
        const covered =
          bounds.min !== null && Date.parse(bounds.min) <= Date.parse(first) + 5 * DAY_MS;
        if (!covered) {
          const n = await this.fetchAndStore(inst.id, inst.symbol, historyRange(first, now), now);
          log.info('historique rempli', { symbol: inst.symbol, jours: n });
        }
        this.backfilled.set(inst.id, first);
      } catch (e) {
        // on retentera au cycle suivant (l'instrument n'est pas marqué comme rempli)
        log.warn('remplissage de l’historique en échec', { symbol: inst.symbol, error: String(e) });
      }
    }
  }

  private async refreshRecent(now: Date) {
    const { store, log } = this.deps;
    const day = parisDate(now);
    const after = isWeekday(day) && parisMinutes(now) >= REFRESH_AFTER_MINUTES;
    const key = `${day}:${after ? 'pm' : 'am'}`;
    if (this.refreshKey !== null && !(after && this.refreshKey !== key)) return;
    this.refreshKey = key;

    for (const inst of await store.listTrackedInstruments()) {
      try {
        if (!(await store.getFirstOrderDate(inst.id))) continue;
        await this.fetchAndStore(inst.id, inst.symbol, '1mo', now);
      } catch (e) {
        log.warn('rafraîchissement de l’historique en échec', {
          symbol: inst.symbol,
          error: String(e),
        });
        this.refreshKey = null; // réessaie au prochain cycle
      }
    }
  }

  private async storeTodayClose(now: Date, quotes: readonly FreshQuote[]) {
    const day = parisDate(now);
    const minutes = parisMinutes(now);
    if (!isWeekday(day) || minutes < CLOSE_MINUTES || minutes >= REFRESH_AFTER_MINUTES) return;

    for (const q of quotes) {
      const key = `${q.instrument.id}:${day}:${q.price}`;
      if (this.closeStored.has(key)) continue;
      // uniquement une cote de l'enchère de clôture du jour
      if (parisDate(q.quotedAt) !== day || parisMinutes(q.quotedAt) < 17 * 60 + 30) continue;
      await this.deps.store.upsertCloses([
        { instrumentId: q.instrument.id, date: day, close: q.price },
      ]);
      this.closeStored.add(key);
    }
  }
}

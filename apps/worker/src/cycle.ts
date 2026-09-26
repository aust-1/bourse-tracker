import { isMarketOpen, isPollingWindow, isWorkWindow } from '@bourse/core';
import type { Message, Notifier, PriceProvider } from '@bourse/providers';
import { evaluateAlerts } from './alerts';
import type { HistoryJob } from './history';
import type { Logger } from './log';
import type { SourceMonitor } from './monitor';
import { pollCycle, type FreshQuote } from './poll';
import type { Store } from './store';
import { sendDailySummaries } from './summary';

/** Hors séance, on ne vérifie les instruments ajoutés qu'à cette cadence. */
export const MAINTENANCE_EVERY_MS = 5 * 60_000;

interface Deps {
  store: Store;
  provider: Pick<PriceProvider, 'getQuote' | 'getDailyCloses'>;
  notifier: Pick<Notifier, 'notify'>;
  monitor: SourceMonitor;
  history: Pick<HistoryJob, 'tick'>;
  log: Logger;
  notifyAll: (m: Message) => Promise<void>;
}

const guarded = (log: Logger, what: string) => (e: unknown) =>
  log.error(what, { error: e instanceof Error ? e.message : String(e) });

/**
 * Un cycle du worker, selon l'heure :
 * - fenêtre de polling (lun-ven 08:55-17:40) et démarrage : cotes, alertes, supervision ;
 * - fenêtre de travail (jusqu'à 23 h) : historique des clôtures et résumé du soir ;
 * - le reste (nuits, week-ends) : toutes les 5 minutes, un instrument tout juste ajouté reçoit
 *   sa dernière cote et son historique, pour que l'écran soit utilisable sans attendre la
 *   prochaine séance. Sinon rien : les cotes déjà connues sont celles de la dernière clôture.
 */
export class Cycle {
  private first = true;
  private lastMaintenance = 0;

  constructor(private readonly d: Deps) {}

  async run(now: Date = new Date()): Promise<{ ran: boolean }> {
    const { store, provider, notifier, monitor, history, log, notifyAll } = this.d;
    const polling = this.first || isPollingWindow(now);
    const working = isWorkWindow(now);

    if (!polling && !working) {
      if (now.getTime() - this.lastMaintenance < MAINTENANCE_EVERY_MS) return { ran: false };
    }
    // un cycle de cotation (démarrage compris) vaut passage de maintenance
    if (polling || !working) this.lastMaintenance = now.getTime();

    let error: string | null = null;
    let quotes: FreshQuote[] = [];
    try {
      if (polling) {
        const started = Date.now();
        const result = await pollCycle({ store, provider, log });
        quotes = result.quotes;

        const lags = quotes.map((q) => Math.round((Date.now() - q.quotedAt.getTime()) / 1000));
        log.info('cycle terminé', {
          instruments: quotes.length,
          updated: result.updated,
          failed: result.failed.length,
          ms: Date.now() - started,
          // retard de cotation observé (mesure du différé de Yahoo en séance)
          marketOpen: isMarketOpen(now),
          maxQuoteLagSeconds: lags.length ? Math.max(...lags) : null,
        });

        const sourceOk = quotes.length > 0 || result.failed.length === 0;
        if (!sourceOk) error = `aucune cote obtenue (${result.failed.length} échecs)`;
        await monitor.check(now, sourceOk, notifyAll).catch(guarded(log, 'supervision'));
        await evaluateAlerts(quotes, { store, notifier, log, now }).catch(guarded(log, 'alertes'));
      } else {
        await this.bootstrapNewInstruments();
      }
      this.first = false;

      await history.tick(now, quotes).catch(guarded(log, 'historique'));
      await sendDailySummaries({ store, notifier, log, now }).catch(guarded(log, 'résumé'));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      await store.recordCycle({ error }).catch(guarded(log, 'worker_status'));
    }
    return { ran: true };
  }

  /** Cote initiale (dernière clôture) des instruments suivis qui n'en ont encore aucune. */
  private async bootstrapNewInstruments() {
    const { store, provider, log } = this.d;
    const tracked = await store.listTrackedInstruments();
    if (tracked.length === 0) return;
    const known = await store.getQuotes(tracked.map((t) => t.id));
    const missing = new Set(tracked.filter((t) => !known.has(t.id)).map((t) => t.id));
    if (missing.size === 0) return;

    const result = await pollCycle({ store, provider, log, only: missing });
    log.info('cote initiale récupérée hors séance', {
      instruments: result.quotes.map((q) => q.instrument.symbol),
      failed: result.failed.length,
    });
  }
}

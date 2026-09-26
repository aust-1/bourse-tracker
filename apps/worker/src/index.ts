import { createClient } from '@supabase/supabase-js';
import type { Database } from '@bourse/db';
import { isMarketOpen, isPollingWindow, isWorkWindow } from '@bourse/core';
import { Notifier, YahooProvider, type Message } from '@bourse/providers';
import { evaluateAlerts } from './alerts';
import { loadConfig } from './config';
import { HistoryJob } from './history';
import { logger as log } from './log';
import { SourceMonitor } from './monitor';
import { pollCycle, type FreshQuote } from './poll';
import { startHeartbeat, startScheduler } from './scheduler';
import { SupabaseStore } from './supabase-store';
import { sendDailySummaries } from './summary';

const config = loadConfig();
const db = createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const store = new SupabaseStore(db);
const provider = new YahooProvider();
const notifier = new Notifier({ resendApiKey: config.resendApiKey, emailFrom: config.emailFrom });
const monitor = new SourceMonitor(config.staleAfterMs, new Date());
const history = new HistoryJob({ store, provider, log });

/** Message système (panne de la source de prix…) : envoyé à tous les canaux configurés. */
async function notifyAll(message: Message) {
  for (const s of await store.listSettings()) {
    await notifier.notify(s, ['discord', 'email'], message);
  }
}

const guarded = (what: string) => (e: unknown) =>
  log.error(what, { error: e instanceof Error ? e.message : String(e) });

let firstCycle = true;

/**
 * Un cycle : les cotes et les alertes pendant la fenêtre de polling (et au démarrage, pour
 * que l'écran ait des cotes même le week-end) ; l'historique et le résumé du soir jusqu'à 23 h.
 */
async function cycle() {
  const now = new Date();
  let error: string | null = null;
  let quotes: FreshQuote[] = [];

  try {
    if (firstCycle || isPollingWindow(now)) {
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
      await monitor.check(now, sourceOk, notifyAll).catch(guarded('supervision'));
      await evaluateAlerts(quotes, { store, notifier, log, now }).catch(guarded('alertes'));
    }
    firstCycle = false;

    await history.tick(now, quotes).catch(guarded('historique'));
    await sendDailySummaries({ store, notifier, log, now }).catch(guarded('résumé'));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await store.recordCycle({ error }).catch(guarded('worker_status'));
  }
}

const heartbeat = startHeartbeat(config.healthchecksUrl, log);
const scheduler = startScheduler({
  intervalMs: config.pollIntervalMs,
  cycle,
  log,
  isActive: isWorkWindow,
});
log.info('worker démarré', { pollIntervalMs: config.pollIntervalMs });

const shutdown = async (signal: string) => {
  log.info('arrêt demandé', { signal });
  heartbeat.stop();
  await scheduler.stop();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

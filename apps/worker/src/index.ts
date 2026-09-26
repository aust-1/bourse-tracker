import { createClient } from '@supabase/supabase-js';
import type { Database } from '@bourse/db';
import { isMarketOpen } from '@bourse/core';
import { YahooProvider } from '@bourse/providers';
import { evaluateAlerts } from './alerts';
import { loadConfig } from './config';
import { HistoryJob } from './history';
import { logger as log } from './log';
import { SourceMonitor } from './monitor';
import { Notifier } from './notify';
import { pollCycle } from './poll';
import { startHeartbeat, startScheduler } from './scheduler';
import { SupabaseStore } from './supabase-store';

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
async function notifyAll(message: Parameters<Notifier['sendDiscord']>[1]) {
  for (const s of await store.listSettings()) {
    await notifier.notify(s, ['discord', 'email'], message);
  }
}

async function cycle() {
  let error: string | null = null;
  try {
    const started = Date.now();
    const result = await pollCycle({ store, provider, log });

    const now = Date.now();
    const lags = result.quotes.map((q) => Math.round((now - q.quotedAt.getTime()) / 1000));
    log.info('cycle terminé', {
      instruments: result.quotes.length,
      updated: result.updated,
      failed: result.failed.length,
      ms: now - started,
      // retard de cotation observé (utile pour mesurer le différé de Yahoo en séance)
      marketOpen: isMarketOpen(new Date()),
      maxQuoteLagSeconds: lags.length ? Math.max(...lags) : null,
    });
    const sourceOk = result.quotes.length > 0 || result.failed.length === 0;
    if (!sourceOk) error = `aucune cote obtenue (${result.failed.length} échecs)`;

    await monitor
      .check(new Date(), sourceOk, notifyAll)
      .catch((e) => log.error('supervision', { error: String(e) }));
    await evaluateAlerts(result.quotes, { store, notifier, log });
    await history
      .tick(new Date(), result.quotes)
      .catch((e) => log.error('historique', { error: String(e) }));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await store
      .recordCycle({ error })
      .catch((e) => log.error('worker_status', { error: String(e) }));
  }
}

const heartbeat = startHeartbeat(config.healthchecksUrl, log);
const scheduler = startScheduler({ intervalMs: config.pollIntervalMs, cycle, log });
log.info('worker démarré', { pollIntervalMs: config.pollIntervalMs });

const shutdown = async (signal: string) => {
  log.info('arrêt demandé', { signal });
  heartbeat.stop();
  await scheduler.stop();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

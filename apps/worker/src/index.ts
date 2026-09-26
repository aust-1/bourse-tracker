import { createClient } from '@supabase/supabase-js';
import type { Database } from '@bourse/db';
import { isMarketOpen } from '@bourse/core';
import { YahooProvider } from '@bourse/providers';
import { loadConfig } from './config';
import { logger as log } from './log';
import { pollCycle } from './poll';
import { startHeartbeat, startScheduler } from './scheduler';
import { SupabaseStore } from './supabase-store';

const config = loadConfig();
const db = createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const store = new SupabaseStore(db);
const provider = new YahooProvider();

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
    if (result.failed.length > 0 && result.quotes.length === 0) {
      error = `aucune cote obtenue (${result.failed.length} échecs)`;
    }
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

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@bourse/db';
import { Notifier, YahooProvider, type Message } from '@bourse/providers';
import { loadConfig } from './config';
import { Cycle } from './cycle';
import { HistoryJob } from './history';
import { logger as log } from './log';
import { SourceMonitor } from './monitor';
import { startHeartbeat, startScheduler } from './scheduler';
import { SupabaseStore } from './supabase-store';

const config = loadConfig();
const db = createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const store = new SupabaseStore(db);
const provider = new YahooProvider();
const notifier = new Notifier({ resendApiKey: config.resendApiKey, emailFrom: config.emailFrom });

/** Message système (panne de la source de prix…) : envoyé aux administrateurs, sur tous leurs canaux. */
async function notifyAll(message: Message) {
  for (const s of await store.listAdminSettings()) {
    await notifier.notify(s, ['discord', 'email'], message);
  }
}

const cycle = new Cycle({
  store,
  provider,
  notifier,
  monitor: new SourceMonitor(config.staleAfterMs, new Date()),
  history: new HistoryJob({ store, provider, log }),
  log,
  notifyAll,
});

const heartbeat = startHeartbeat(config.healthchecksUrl, log);
const scheduler = startScheduler({
  intervalMs: config.pollIntervalMs,
  cycle: async () => {
    await cycle.run();
  },
  log,
  // le tri selon l'heure (séance, soirée, nuit) est fait par Cycle : le planificateur tourne toujours
  isActive: () => true,
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

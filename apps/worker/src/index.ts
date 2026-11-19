import { createClient } from '@supabase/supabase-js';
import type { Database } from '@bourse/db';
import {
  ALL_CHANNELS,
  EodhdProvider,
  FallbackProvider,
  Notifier,
  ntfyHosts,
  YahooProvider,
  type Message,
  type PriceProvider,
} from '@bourse/providers';
import { loadConfig } from './config';
import { Cycle } from './cycle';
import { fetchWithTimeout, SUPABASE_TIMEOUT_MS } from './fetch-timeout';
import { HistoryJob } from './history';
import { logger as log } from './log';
import { SourceMonitor } from './monitor';
import { releaseInterruptedAlerts } from './recovery';
import { createHeartbeat, startScheduler } from './scheduler';
import { SupabaseStore } from './supabase-store';

const config = loadConfig();
const db = createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  // une requête sans réponse fait échouer le cycle au lieu de bloquer la boucle
  global: { fetch: fetchWithTimeout(SUPABASE_TIMEOUT_MS) },
});
const store = new SupabaseStore(db);
// Yahoo, et EODHD en secours des cotes si une clé est configurée
const provider: PriceProvider = config.eodhdApiKey
  ? new FallbackProvider(new YahooProvider(), new EodhdProvider({ apiKey: config.eodhdApiKey }), {
      onSwitch: (to, reason) => log.warn('source de prix basculée', { to, reason }),
    })
  : new YahooProvider();
const notifier = new Notifier({
  resendApiKey: config.resendApiKey,
  emailFrom: config.emailFrom,
  telegramBotToken: config.telegramBotToken,
  ntfyHosts: ntfyHosts(process.env.NTFY_HOSTS),
});

/** Message système (panne de la source de prix…) : envoyé aux administrateurs, sur tous leurs canaux. */
async function notifyAll(message: Message) {
  for (const s of await store.listAdminSettings()) {
    await notifier.notify(s, ALL_CHANNELS, message);
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

/** Doit rester sous `stop_grace_period` du service worker (docker-compose.yml, 30 s). */
const SHUTDOWN_TIMEOUT_MS = 25_000;

// alertes prises mais pas envoyées par l'exécution précédente (arrêt pendant l'envoi)
await releaseInterruptedAlerts({ store, log }).catch((e: unknown) =>
  log.error('reprise des alertes interrompues en échec', {
    error: e instanceof Error ? e.message : String(e),
  }),
);

// ping après chaque cycle terminé : une boucle bloquée n'en envoie plus
const heartbeat = createHeartbeat(config.healthchecksUrl, log);
const scheduler = startScheduler({
  intervalMs: config.pollIntervalMs,
  cycle: async () => {
    await cycle.run();
  },
  log,
  // le tri selon l'heure (séance, soirée, nuit) est fait par Cycle : le planificateur tourne toujours
  isActive: () => true,
  onCycleDone: () => heartbeat.beat(),
});
log.info('worker démarré', { pollIntervalMs: config.pollIntervalMs });

let stopping = false;
/** Arrêt propre : la pause est interrompue, le cycle en cours (envois compris) se termine. */
const shutdown = async (signal: string) => {
  if (stopping) return;
  stopping = true;
  log.info('arrêt demandé', { signal });
  setTimeout(() => {
    log.error('arrêt forcé : le cycle en cours ne s’est pas terminé à temps', {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  await scheduler.stop();
  log.info('worker arrêté');
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

import { isPollingWindow } from '@bourse/core';
import type { Logger } from './log';

export interface SchedulerOptions {
  intervalMs: number;
  /** Exécute un cycle complet (cotes, alertes, résumé…). Ne doit pas lever. */
  cycle: () => Promise<void>;
  log: Logger;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Boucle principale. Un premier cycle part toujours au démarrage (les cotes sont
 * disponibles même le week-end), puis un cycle toutes les `intervalMs` dans la fenêtre
 * de séance ; hors fenêtre, on ne fait que revérifier l'heure.
 */
export function startScheduler(opts: SchedulerOptions) {
  const now = opts.now ?? (() => new Date());
  const sleep = opts.sleep ?? defaultSleep;
  let running = true;

  const done = (async () => {
    let first = true;
    while (running) {
      const started = Date.now();
      if (first || isPollingWindow(now())) {
        first = false;
        try {
          await opts.cycle();
        } catch (e) {
          opts.log.error('cycle en échec', { error: e instanceof Error ? e.message : String(e) });
        }
      }
      const elapsed = Date.now() - started;
      await sleep(Math.max(1000, opts.intervalMs - elapsed));
    }
  })();

  return {
    /** Se résout quand la boucle est arrêtée. */
    done,
    async stop() {
      running = false;
      await done;
    },
  };
}

/** Ping périodique de supervision (Healthchecks.io), indépendant des cycles de prix. */
export function startHeartbeat(url: string | null, log: Logger, everyMs = 60_000) {
  if (!url) return { stop() {} };
  const ping = async () => {
    try {
      await fetch(url, { signal: AbortSignal.timeout(10_000) });
    } catch (e) {
      log.warn('ping de supervision en échec', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };
  void ping();
  const timer = setInterval(ping, everyMs);
  return { stop: () => clearInterval(timer) };
}

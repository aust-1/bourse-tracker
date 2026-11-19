import { isPollingWindow } from '@bourse/core';
import type { Logger } from './log';

export interface SchedulerOptions {
  intervalMs: number;
  /** Exécute un cycle complet (cotes, alertes, résumé…). Ne doit pas lever. */
  cycle: () => Promise<void>;
  log: Logger;
  now?: () => Date;
  /** Fenêtre pendant laquelle les cycles tournent (défaut : fenêtre de polling des cotes). */
  isActive?: (at: Date) => boolean;
  /** Pause entre deux cycles ; doit se terminer dès que `signal` est interrompu (arrêt). */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Appelé après chaque cycle terminé sans erreur (ping de supervision). */
  onCycleDone?: () => void;
}

/** Pause interruptible : l'arrêt du worker n'attend pas la fin des 30 s. */
export const interruptibleSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
  });

/**
 * Boucle principale. Un premier cycle part toujours au démarrage (les cotes sont
 * disponibles même le week-end), puis un cycle toutes les `intervalMs` dans la fenêtre
 * de séance ; hors fenêtre, on ne fait que revérifier l'heure.
 * `stop()` interrompt la pause en cours et laisse le cycle en cours se terminer.
 */
export function startScheduler(opts: SchedulerOptions) {
  const now = opts.now ?? (() => new Date());
  const sleep = opts.sleep ?? interruptibleSleep;
  const isActive = opts.isActive ?? isPollingWindow;
  const stopping = new AbortController();
  let running = true;

  const done = (async () => {
    let first = true;
    while (running) {
      const started = Date.now();
      if (first || isActive(now())) {
        first = false;
        try {
          await opts.cycle();
          opts.onCycleDone?.();
        } catch (e) {
          opts.log.error('cycle en échec', { error: e instanceof Error ? e.message : String(e) });
        }
      }
      if (!running) break;
      const elapsed = Date.now() - started;
      await sleep(Math.max(1000, opts.intervalMs - elapsed), stopping.signal);
    }
  })();

  return {
    /** Se résout quand la boucle est arrêtée. */
    done,
    /** Interrompt la pause et attend la fin du cycle en cours. */
    async stop() {
      running = false;
      stopping.abort();
      await done;
    },
  };
}

/**
 * Ping de supervision (Healthchecks.io), au plus une fois par `everyMs`, appelé après chaque cycle
 * terminé : si la boucle se bloque (requête sans réponse), les pings cessent et Healthchecks.io
 * alerte, alors qu'un ping à intervalle fixe prouvait seulement que le processus vivait.
 */
export function createHeartbeat(
  url: string | null,
  log: Logger,
  everyMs = 60_000,
  now: () => number = Date.now,
) {
  let last = -Infinity;
  return {
    beat() {
      if (!url) return;
      const t = now();
      if (t - last < everyMs) return;
      last = t;
      void fetch(url, { signal: AbortSignal.timeout(10_000) }).catch((e: unknown) =>
        log.warn('ping de supervision en échec', {
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    },
  };
}

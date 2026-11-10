import { quoteFreshness } from '@bourse/core';

/** Le worker passe au moins toutes les 5 minutes (maintenance de nuit) : au-delà de 10, il est muet. */
export const WORKER_LATE_MS = 10 * 60_000;

export type WorkerHealth = 'ok' | 'late' | 'unknown';

export function workerHealth(lastCycleAt: string | null, now: Date): WorkerHealth {
  if (!lastCycleAt) return 'unknown';
  return now.getTime() - new Date(lastCycleAt).getTime() > WORKER_LATE_MS ? 'late' : 'ok';
}

export type QuoteHealth =
  | { kind: 'missing' }
  | { kind: 'live' }
  | { kind: 'delayed'; minutes: number }
  | { kind: 'closed' };

/** État de la cote d'un instrument : absente, en direct, différée (en séance) ou de clôture. */
export function quoteHealth(quotedAt: string | null, now: Date): QuoteHealth {
  if (!quotedAt) return { kind: 'missing' };
  const f = quoteFreshness(quotedAt, now);
  return f.kind === 'closed' ? { kind: 'closed' } : f;
}

/** Durée lisible : « 45 s », « 12 min », « 3 h », « 2 j ». */
export function ago(at: string, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - new Date(at).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86_400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86_400)} j`;
}

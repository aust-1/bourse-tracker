import type { DailyClose } from '@bourse/providers';
import { yahoo } from './yahoo';

const TTL_MS = 6 * 3600_000;
const cache = new Map<string, { at: number; closes: DailyClose[] }>();

/**
 * Clôtures journalières de l'indice, gardées 6 h en mémoire : la page Historique ne
 * sollicite pas Yahoo à chaque affichage. null si la source ne répond pas.
 */
export async function loadBenchmarkCloses(symbol: string): Promise<DailyClose[] | null> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.closes;
  try {
    const closes = await yahoo.getDailyCloses(symbol, 'max');
    cache.set(symbol, { at: Date.now(), closes });
    return closes;
  } catch {
    return hit?.closes ?? null;
  }
}

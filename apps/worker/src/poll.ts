import { parisDate } from '@bourse/core';
import { getQuotes, type PriceProvider } from '@bourse/providers';
import type { Logger } from './log';
import type { Store, TrackedInstrument } from './store';

export interface FreshQuote {
  instrument: TrackedInstrument;
  price: number;
  prevClose: number | null;
  quotedAt: Date;
}

export interface CycleResult {
  /** Cotes obtenues pendant ce cycle (à jour ou non), pour l'évaluation des alertes. */
  quotes: FreshQuote[];
  updated: number;
  failed: { symbol: string; error: string }[];
}

interface Deps {
  store: Store;
  provider: Pick<PriceProvider, 'getQuote'>;
  log: Logger;
  concurrency?: number;
}

/** Un cycle de polling : récupère les cotes, n'écrit que ce qui a changé. */
export async function pollCycle({
  store,
  provider,
  log,
  concurrency = 5,
}: Deps): Promise<CycleResult> {
  const tracked = await store.listTrackedInstruments();
  if (tracked.length === 0) return { quotes: [], updated: 0, failed: [] };

  const bySymbol = new Map(tracked.map((t) => [t.symbol, t]));
  const existing = await store.getQuotes(tracked.map((t) => t.id));
  const { quotes, errors } = await getQuotes(
    provider,
    tracked.map((t) => t.symbol),
    concurrency,
  );

  const fresh: FreshQuote[] = [];
  const failed = errors.map((e) => ({ symbol: e.symbol, error: e.error.message }));
  let updated = 0;

  for (const q of quotes) {
    const instrument = bySymbol.get(q.symbol)!;
    if (q.currency !== 'EUR' || !(q.price > 0)) {
      failed.push({ symbol: q.symbol, error: `cote inexploitable (${q.currency} ${q.price})` });
      continue;
    }
    const prevClose =
      q.prevClose ?? (await store.getPrevCloseFallback(instrument.id, parisDate(q.quotedAt)));

    const before = existing.get(instrument.id);
    const changed =
      !before ||
      before.quotedAt.getTime() < q.quotedAt.getTime() ||
      before.price !== q.price ||
      before.prevClose !== prevClose;
    if (changed) {
      await store.upsertQuote({
        instrumentId: instrument.id,
        price: q.price,
        prevClose,
        quotedAt: q.quotedAt,
      });
      updated++;
    }
    fresh.push({ instrument, price: q.price, prevClose, quotedAt: q.quotedAt });
  }

  if (failed.length > 0) log.warn('échecs de cotation', { failed });
  return { quotes: fresh, updated, failed };
}

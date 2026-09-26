import { parisDate } from '@bourse/core';
import {
  ProviderError,
  type DailyClose,
  type PriceProvider,
  type Quote,
  type SearchHit,
  type SeriesPoint,
  type SeriesRange,
} from './types';

const CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const SEARCH_URL = 'https://query2.finance.yahoo.com/v1/finance/search';

/** Places européennes de l'EEE (le PEA n'accepte que des titres de l'EEE). */
export const EUROPEAN_EXCHANGES = new Set([
  'PAR',
  'AMS',
  'BRU',
  'LIS',
  'MIL',
  'MCE',
  'GER',
  'FRA',
  'HEL',
  'ISE',
  'VIE',
]);

export interface YahooOptions {
  fetch?: typeof fetch;
  /** Nombre de nouvelles tentatives sur 429 / 5xx / erreur réseau (défaut 2). */
  retries?: number;
  /** Délai de base du backoff en ms (défaut 500). */
  backoffMs?: number;
  timeoutMs?: number;
}

interface ChartResult {
  meta: Record<string, unknown>;
  timestamp?: number[];
  indicators?: { quote?: { close?: (number | null)[] }[] };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class YahooProvider implements PriceProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly timeoutMs: number;

  constructor(opts: YahooOptions = {}) {
    this.fetchImpl = opts.fetch ?? fetch;
    this.retries = opts.retries ?? 2;
    this.backoffMs = opts.backoffMs ?? 500;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  private async getJson(url: string): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) await sleep(this.backoffMs * 2 ** (attempt - 1));
      try {
        const res = await this.fetchImpl(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bourse-tracker)' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (res.ok) return await res.json();
        lastError = new ProviderError(`Yahoo HTTP ${res.status}`, res.status);
        // 4xx (hors 429) : inutile de réessayer
        if (res.status < 500 && res.status !== 429) throw lastError;
      } catch (e) {
        if (e instanceof ProviderError && e.status && e.status < 500 && e.status !== 429) throw e;
        lastError = e;
      }
    }
    throw lastError instanceof Error ? lastError : new ProviderError('Yahoo: erreur inconnue');
  }

  private async chart(symbol: string, range: string, interval: string): Promise<ChartResult> {
    const url = `${CHART_URL}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
    const json = (await this.getJson(url)) as {
      chart?: { result?: ChartResult[] | null; error?: { description?: string } | null };
    };
    const result = json.chart?.result?.[0];
    if (!result) {
      throw new ProviderError(
        json.chart?.error?.description ?? `Symbole introuvable : ${symbol}`,
        404,
      );
    }
    return result;
  }

  async getQuote(symbol: string): Promise<Quote> {
    // range=1d : c'est le seul cas où previousClose est la clôture de la veille
    const { meta } = await this.chart(symbol, '1d', '1m');
    const price = meta.regularMarketPrice;
    const time = meta.regularMarketTime;
    if (typeof price !== 'number' || typeof time !== 'number') {
      throw new ProviderError(`Cote incomplète pour ${symbol}`);
    }
    const prev = meta.previousClose ?? meta.chartPreviousClose;
    return {
      symbol,
      price,
      prevClose: typeof prev === 'number' ? prev : null,
      quotedAt: new Date(time * 1000),
      currency: String(meta.currency ?? ''),
      name:
        typeof meta.longName === 'string'
          ? meta.longName
          : typeof meta.shortName === 'string'
            ? meta.shortName
            : null,
      exchange: typeof meta.exchangeName === 'string' ? meta.exchangeName : null,
    };
  }

  async getDailyCloses(symbol: string, range: '1mo' | '1y' | 'max'): Promise<DailyClose[]> {
    const r = await this.chart(symbol, range, '1d');
    const closes = r.indicators?.quote?.[0]?.close ?? [];
    const out: DailyClose[] = [];
    (r.timestamp ?? []).forEach((t, i) => {
      const close = closes[i];
      // la bougie du jour peut avoir un close null : on l'ignore (le worker utilise la cote)
      if (typeof close === 'number') out.push({ date: parisDate(new Date(t * 1000)), close });
    });
    return out;
  }

  async getSeries(symbol: string, range: SeriesRange): Promise<SeriesPoint[]> {
    const interval = range === '1d' ? '5m' : range === '1mo' ? '60m' : '1d';
    const r = await this.chart(symbol, range, interval);
    const closes = r.indicators?.quote?.[0]?.close ?? [];
    const out: SeriesPoint[] = [];
    (r.timestamp ?? []).forEach((t, i) => {
      const close = closes[i];
      if (typeof close === 'number') out.push({ t: new Date(t * 1000), close });
    });
    return out;
  }

  async search(query: string): Promise<SearchHit[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0&lang=fr-FR`;
    const json = (await this.getJson(url)) as {
      quotes?: {
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchange?: string;
        exchDisp?: string;
        quoteType?: string;
      }[];
    };
    const hits: SearchHit[] = [];
    for (const h of json.quotes ?? []) {
      if (!h.symbol || !h.exchange || !EUROPEAN_EXCHANGES.has(h.exchange)) continue;
      if (h.quoteType !== 'EQUITY' && h.quoteType !== 'ETF') continue;
      hits.push({
        symbol: h.symbol,
        name: h.longname ?? h.shortname ?? h.symbol,
        exchange: h.exchange,
        exchangeName: h.exchDisp ?? h.exchange,
        type: h.quoteType,
      });
    }
    return hits;
  }
}

/** Cotes de plusieurs symboles avec concurrence limitée ; les échecs sont rapportés, pas levés. */
export async function getQuotes(
  provider: Pick<PriceProvider, 'getQuote'>,
  symbols: readonly string[],
  concurrency = 5,
): Promise<{ quotes: Quote[]; errors: { symbol: string; error: Error }[] }> {
  const quotes: Quote[] = [];
  const errors: { symbol: string; error: Error }[] = [];
  let next = 0;
  const worker = async () => {
    while (next < symbols.length) {
      const symbol = symbols[next++]!;
      try {
        quotes.push(await provider.getQuote(symbol));
      } catch (e) {
        errors.push({ symbol, error: e instanceof Error ? e : new Error(String(e)) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, worker));
  return { quotes, errors };
}

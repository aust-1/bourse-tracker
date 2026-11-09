import { ProviderError, type PriceProvider, type Quote } from './types';

const API = 'https://eodhd.com/api';

/** Suffixe Yahoo → code de place EODHD (places européennes cotant en euros). */
const EXCHANGES: Record<string, string> = {
  PA: 'PA',
  AS: 'AS',
  BR: 'BR',
  LS: 'LS',
  MI: 'MI',
  MC: 'MC',
  DE: 'XETRA',
  F: 'F',
  HE: 'HE',
  IR: 'IR',
  VI: 'VI',
};

/** Symbole Yahoo (CW8.PA, SAP.DE, ^FCHI) → symbole EODHD (CW8.PA, SAP.XETRA, FCHI.INDX). */
export function toEodhdSymbol(yahoo: string): string | null {
  if (yahoo.startsWith('^')) return `${yahoo.slice(1)}.INDX`;
  const m = /^(.+)\.([A-Z]+)$/.exec(yahoo);
  if (!m) return null;
  const exchange = EXCHANGES[m[2]!];
  return exchange ? `${m[1]}.${exchange}` : null;
}

export interface EodhdOptions {
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface RealTime {
  code?: string;
  timestamp?: number | string;
  close?: number | string;
  previousClose?: number | string;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/**
 * Source de secours (EODHD, clé d'API payante) : cotes uniquement. Les clôtures, la recherche et
 * les séries restent sur la source principale (ajustements des splits identiques à Yahoo).
 */
export class EodhdProvider implements Pick<PriceProvider, 'getQuote'> {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: EodhdOptions) {
    this.fetchImpl = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const code = toEodhdSymbol(symbol);
    if (!code) throw new ProviderError(`EODHD : place non prise en charge pour ${symbol}`);
    const url = `${API}/real-time/${encodeURIComponent(code)}?api_token=${encodeURIComponent(this.opts.apiKey)}&fmt=json`;
    const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new ProviderError(`EODHD HTTP ${res.status}`, res.status);
    const data = (await res.json()) as RealTime;
    const price = num(data.close);
    const time = num(data.timestamp);
    if (price === null || time === null)
      throw new ProviderError(`EODHD : cote incomplète pour ${symbol}`);
    return {
      // le symbole demandé (Yahoo) : le worker rattache la cote par ce symbole
      symbol,
      price,
      prevClose: num(data.previousClose),
      quotedAt: new Date(time * 1000),
      currency: 'EUR',
      name: null,
      exchange: null,
    };
  }
}

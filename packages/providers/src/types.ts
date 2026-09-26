export interface Quote {
  symbol: string;
  price: number;
  /** Clôture de la séance précédente ; null si Yahoo ne la fournit pas. */
  prevClose: number | null;
  /** Heure de la dernière cotation connue (pas l'heure de la requête). */
  quotedAt: Date;
  currency: string;
  name: string | null;
  exchange: string | null;
}

export interface DailyClose {
  /** Date de séance à Paris, YYYY-MM-DD */
  date: string;
  close: number;
}

export interface SeriesPoint {
  t: Date;
  close: number;
}

export type SeriesRange = '1d' | '1mo' | '1y';

export interface SearchHit {
  symbol: string;
  name: string;
  /** Code de place Yahoo (PAR, AMS, GER…) */
  exchange: string;
  exchangeName: string;
  type: 'EQUITY' | 'ETF';
}

/** Source de prix. Un seul fichier à changer pour brancher un autre fournisseur. */
export interface PriceProvider {
  getQuote(symbol: string): Promise<Quote>;
  getDailyCloses(symbol: string, range: '1mo' | '1y' | 'max'): Promise<DailyClose[]>;
  getSeries(symbol: string, range: SeriesRange): Promise<SeriesPoint[]>;
  search(query: string): Promise<SearchHit[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

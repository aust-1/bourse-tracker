import type {
  DailyClose,
  PriceProvider,
  Quote,
  SearchHit,
  SeriesPoint,
  SeriesRange,
} from './types';

export interface FallbackOptions {
  /** Échecs consécutifs de la source principale avant de passer sur la source de secours */
  failureThreshold?: number;
  /** Durée pendant laquelle la source de secours passe en premier, avant de retenter la principale */
  cooldownMs?: number;
  now?: () => number;
  /** Appelé à chaque bascule (journalisation) */
  onSwitch?: (to: 'primary' | 'secondary', reason: string) => void;
}

/**
 * Source principale + source de secours pour les cotes, avec disjoncteur : après N échecs
 * consécutifs de la principale, la secours passe en premier pendant `cooldownMs`, puis la
 * principale est retentée. Les clôtures, séries et recherches restent sur la principale.
 */
export class FallbackProvider implements PriceProvider {
  private failures = 0;
  private openUntil = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(
    private readonly primary: PriceProvider,
    private readonly secondary: Pick<PriceProvider, 'getQuote'>,
    private readonly opts: FallbackOptions = {},
  ) {
    this.threshold = opts.failureThreshold ?? 3;
    this.cooldownMs = opts.cooldownMs ?? 15 * 60_000;
    this.now = opts.now ?? Date.now;
  }

  /** Vrai tant que la source de secours passe en premier. */
  get usingSecondary(): boolean {
    return this.now() < this.openUntil;
  }

  async getQuote(symbol: string): Promise<Quote & { source: 'primary' | 'secondary' }> {
    if (this.usingSecondary) {
      try {
        return { ...(await this.secondary.getQuote(symbol)), source: 'secondary' };
      } catch {
        // la secours échoue aussi : on tente quand même la principale
      }
    }
    try {
      const q = await this.primary.getQuote(symbol);
      if (this.failures > 0 || this.openUntil > 0) {
        if (this.openUntil > 0) this.opts.onSwitch?.('primary', 'source principale rétablie');
        this.failures = 0;
        this.openUntil = 0;
      }
      return { ...q, source: 'primary' };
    } catch (e) {
      this.failures++;
      if (this.failures >= this.threshold && !this.usingSecondary) {
        this.openUntil = this.now() + this.cooldownMs;
        this.opts.onSwitch?.(
          'secondary',
          `${this.failures} échecs consécutifs : ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      try {
        return { ...(await this.secondary.getQuote(symbol)), source: 'secondary' };
      } catch {
        throw e; // l'erreur de la principale est la plus parlante
      }
    }
  }

  getDailyCloses(symbol: string, range: '1mo' | '1y' | 'max'): Promise<DailyClose[]> {
    return this.primary.getDailyCloses(symbol, range);
  }

  getSeries(symbol: string, range: SeriesRange): Promise<SeriesPoint[]> {
    return this.primary.getSeries(symbol, range);
  }

  search(query: string): Promise<SearchHit[]> {
    return this.primary.search(query);
  }
}

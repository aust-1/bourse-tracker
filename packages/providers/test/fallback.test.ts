import { describe, expect, it, vi } from 'vitest';
import { EodhdProvider, toEodhdSymbol } from '../src/eodhd';
import { FallbackProvider } from '../src/fallback';
import type { PriceProvider, Quote } from '../src/types';

const quote = (symbol: string, price: number): Quote => ({
  symbol,
  price,
  prevClose: null,
  quotedAt: new Date('2026-11-10T10:00:00Z'),
  currency: 'EUR',
  name: null,
  exchange: null,
});

const primaryMock = () => ({
  getQuote: vi.fn<PriceProvider['getQuote']>(),
  getDailyCloses: vi.fn<PriceProvider['getDailyCloses']>(async () => []),
  getSeries: vi.fn<PriceProvider['getSeries']>(async () => []),
  search: vi.fn<PriceProvider['search']>(async () => []),
});

describe('toEodhdSymbol', () => {
  it.each([
    ['CW8.PA', 'CW8.PA'],
    ['SAP.DE', 'SAP.XETRA'],
    ['ASML.AS', 'ASML.AS'],
    ['^FCHI', 'FCHI.INDX'],
    ['AAPL', null],
    ['VOD.L', null],
  ])('%s → %s', (yahoo, expected) => {
    expect(toEodhdSymbol(yahoo)).toBe(expected);
  });
});

describe('EodhdProvider', () => {
  it('cote temps réel : prix, veille, horodatage ; symbole Yahoo conservé', async () => {
    const fetch = vi.fn(
      async (_input: string | URL | Request) =>
        new Response(
          JSON.stringify({
            code: 'CW8.PA',
            timestamp: 1762768800,
            close: 612.5,
            previousClose: '610.1',
          }),
        ),
    );
    const q = await new EodhdProvider({ apiKey: 'k', fetch }).getQuote('CW8.PA');
    expect(String(fetch.mock.calls[0]![0])).toContain('/real-time/CW8.PA?api_token=k');
    expect(q).toMatchObject({ symbol: 'CW8.PA', price: 612.5, prevClose: 610.1, currency: 'EUR' });
    expect(q.quotedAt.getTime()).toBe(1762768800 * 1000);
  });

  it('cote incomplète (« NA ») : erreur', async () => {
    const fetch = vi.fn(
      async (_input: string | URL | Request) =>
        new Response(JSON.stringify({ timestamp: 'NA', close: 'NA' })),
    );
    await expect(new EodhdProvider({ apiKey: 'k', fetch }).getQuote('CW8.PA')).rejects.toThrow(
      'incomplète',
    );
  });
});

describe('FallbackProvider', () => {
  it('source principale en temps normal', async () => {
    const primary = primaryMock();
    primary.getQuote.mockResolvedValue(quote('CW8.PA', 600));
    const secondary = { getQuote: vi.fn() };
    const p = new FallbackProvider(primary, secondary);
    expect(await p.getQuote('CW8.PA')).toMatchObject({ price: 600, source: 'primary' });
    expect(secondary.getQuote).not.toHaveBeenCalled();
  });

  it('échec ponctuel : la secours répond, sans basculer', async () => {
    const primary = primaryMock();
    primary.getQuote.mockRejectedValueOnce(new Error('HTTP 503')).mockResolvedValue(quote('X', 1));
    const secondary = { getQuote: vi.fn(async (s: string) => quote(s, 2)) };
    const p = new FallbackProvider(primary, secondary, { failureThreshold: 3 });
    expect(await p.getQuote('X')).toMatchObject({ price: 2, source: 'secondary' });
    expect(p.usingSecondary).toBe(false);
    expect(await p.getQuote('X')).toMatchObject({ price: 1, source: 'primary' });
  });

  it('disjoncteur : après 3 échecs, la secours passe en premier, puis la principale est retentée', async () => {
    let now = 0;
    const onSwitch = vi.fn();
    const primary = primaryMock();
    primary.getQuote.mockRejectedValue(new Error('HTTP 429'));
    const secondary = { getQuote: vi.fn(async (s: string) => quote(s, 2)) };
    const p = new FallbackProvider(primary, secondary, {
      failureThreshold: 3,
      cooldownMs: 60_000,
      now: () => now,
      onSwitch,
    });
    for (let i = 0; i < 3; i++) await p.getQuote('X');
    expect(p.usingSecondary).toBe(true);
    expect(onSwitch).toHaveBeenCalledWith('secondary', expect.stringContaining('429'));

    primary.getQuote.mockClear();
    await p.getQuote('X');
    expect(primary.getQuote).not.toHaveBeenCalled();

    now = 61_000;
    primary.getQuote.mockResolvedValue(quote('X', 1));
    expect(await p.getQuote('X')).toMatchObject({ source: 'primary' });
    expect(onSwitch).toHaveBeenLastCalledWith('primary', expect.any(String));
  });

  it("les deux sources échouent : l'erreur de la principale remonte", async () => {
    const primary = primaryMock();
    primary.getQuote.mockRejectedValue(new Error('Yahoo HTTP 503'));
    const secondary = { getQuote: vi.fn(async () => Promise.reject(new Error('EODHD HTTP 401'))) };
    await expect(new FallbackProvider(primary, secondary).getQuote('X')).rejects.toThrow('Yahoo');
  });

  it('clôtures, séries et recherche : toujours la principale', async () => {
    const primary = primaryMock();
    const p = new FallbackProvider(primary, { getQuote: vi.fn() });
    await p.getDailyCloses('X', '1mo');
    await p.getSeries('X', '1y');
    await p.search('x');
    expect(primary.getDailyCloses).toHaveBeenCalled();
    expect(primary.getSeries).toHaveBeenCalled();
    expect(primary.search).toHaveBeenCalled();
  });
});

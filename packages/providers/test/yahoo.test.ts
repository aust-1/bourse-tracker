import { describe, expect, it, vi } from 'vitest';
import { getQuotes, ProviderError, YahooProvider } from '../src';

// Fixtures calquées sur les réponses réelles observées le 2026-09-26 (CW8.PA)
const chart1d = {
  chart: {
    result: [
      {
        meta: {
          currency: 'EUR',
          symbol: 'CW8.PA',
          exchangeName: 'PAR',
          instrumentType: 'ETF',
          regularMarketTime: 1790350528,
          regularMarketPrice: 701.13,
          chartPreviousClose: 698.18,
          previousClose: 698.18,
          longName: 'Amundi Index Solutions - Amundi MSCI World Swap UCITS ETF EUR Acc',
          shortName: 'Amundi MSCI World Swap UCITS ET',
        },
        timestamp: [1790337000, 1790337060],
        indicators: { quote: [{ close: [700.1, 701.13] }] },
      },
    ],
    error: null,
  },
};

const chartDaily = {
  chart: {
    result: [
      {
        meta: { currency: 'EUR', chartPreviousClose: 687.71 },
        // 2026-09-23 09:00 Paris, 2026-09-24 09:00 Paris, 2026-09-25 (bougie sans close)
        timestamp: [1790146800, 1790233200, 1790319600],
        indicators: { quote: [{ close: [702.27, 698.18, null] }] },
      },
    ],
    error: null,
  },
};

const search = {
  quotes: [
    {
      symbol: 'CW8.PA',
      shortname: 'Amundi MSCI World Swap UCITS ET',
      longname: 'Amundi MSCI World Swap UCITS ETF EUR Acc',
      exchange: 'PAR',
      exchDisp: 'Paris',
      quoteType: 'ETF',
    },
    {
      symbol: 'LWCU.DE',
      shortname: 'Amundi ETF-MSCI W.E.B.T.U.ETF B',
      exchange: 'GER',
      exchDisp: 'XETRA',
      quoteType: 'ETF',
    },
    {
      symbol: 'IE000AZV0AS3.SG',
      shortname: 'Amundi MSCI World IMI',
      exchange: 'STU',
      exchDisp: 'Stuttgart',
      quoteType: 'MUTUALFUND',
    },
    {
      symbol: 'AAPL',
      shortname: 'Apple',
      exchange: 'NMS',
      exchDisp: 'NASDAQ',
      quoteType: 'EQUITY',
    },
  ],
};

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const fast = { backoffMs: 1 };

describe('YahooProvider', () => {
  it('getQuote : prix, clôture veille, heure de cotation, devise', async () => {
    const fetch = vi.fn().mockResolvedValue(ok(chart1d));
    const q = await new YahooProvider({ fetch }).getQuote('CW8.PA');
    expect(q).toMatchObject({
      symbol: 'CW8.PA',
      price: 701.13,
      prevClose: 698.18,
      currency: 'EUR',
      exchange: 'PAR',
    });
    expect(q.quotedAt.toISOString()).toBe(new Date(1790350528 * 1000).toISOString());
    expect(q.name).toContain('Amundi');
    expect(String(fetch.mock.calls[0]![0])).toContain('range=1d&interval=1m');
  });

  it('getQuote : réponse sans prix → erreur', async () => {
    const bad = { chart: { result: [{ meta: { currency: 'EUR' } }] } };
    const fetch = vi.fn().mockResolvedValue(ok(bad));
    await expect(new YahooProvider({ fetch }).getQuote('X')).rejects.toThrow(ProviderError);
  });

  it('getQuote : symbole inconnu → ProviderError 404 sans nouvelle tentative', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
    await expect(new YahooProvider({ fetch, ...fast }).getQuote('NOPE')).rejects.toMatchObject({
      status: 404,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('réessaie sur 429 puis réussit', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(ok(chart1d));
    const q = await new YahooProvider({ fetch, ...fast }).getQuote('CW8.PA');
    expect(q.price).toBe(701.13);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('abandonne après les tentatives autorisées', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    await expect(
      new YahooProvider({ fetch, retries: 2, ...fast }).getQuote('CW8.PA'),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('réessaie sur erreur réseau', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(ok(chart1d));
    expect((await new YahooProvider({ fetch, ...fast }).getQuote('CW8.PA')).price).toBe(701.13);
  });

  it('getDailyCloses : dates parisiennes, clôtures nulles ignorées', async () => {
    const fetch = vi.fn().mockResolvedValue(ok(chartDaily));
    const closes = await new YahooProvider({ fetch }).getDailyCloses('CW8.PA', 'max');
    expect(closes).toEqual([
      { date: '2026-09-23', close: 702.27 },
      { date: '2026-09-24', close: 698.18 },
    ]);
  });

  it('search : garde ETF/actions européens, écarte fonds et places non européennes', async () => {
    const fetch = vi.fn().mockResolvedValue(ok(search));
    const hits = await new YahooProvider({ fetch }).search('amundi msci world');
    expect(hits.map((h) => h.symbol)).toEqual(['CW8.PA', 'LWCU.DE']);
    expect(hits[0]).toMatchObject({ exchange: 'PAR', exchangeName: 'Paris', type: 'ETF' });
  });

  it('search : requête trop courte → aucun appel réseau', async () => {
    const fetch = vi.fn();
    expect(await new YahooProvider({ fetch }).search('a')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('getQuotes', () => {
  it('rapporte les échecs sans bloquer les autres symboles', async () => {
    const provider = {
      getQuote: async (symbol: string) => {
        if (symbol === 'BAD') throw new Error('boom');
        return {
          symbol,
          price: 1,
          prevClose: null,
          quotedAt: new Date(),
          currency: 'EUR',
          name: null,
          exchange: null,
        };
      },
    };
    const r = await getQuotes(provider, ['A', 'BAD', 'B'], 2);
    expect(r.quotes.map((q) => q.symbol).sort()).toEqual(['A', 'B']);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.symbol).toBe('BAD');
  });
});

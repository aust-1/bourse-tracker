import { describe, expect, it } from 'vitest';
import type { Quote } from '@bourse/providers';
import { silentLogger } from './log';
import { MemoryStore } from './memory-store';
import { pollCycle } from './poll';

const quote = (symbol: string, o: Partial<Quote> = {}): Quote => ({
  symbol,
  price: 100,
  prevClose: 99,
  quotedAt: new Date('2026-09-25T10:00:00Z'),
  currency: 'EUR',
  name: symbol,
  exchange: 'PAR',
  ...o,
});

const setup = () => {
  const store = new MemoryStore();
  store.tracked = [
    { id: 'i1', symbol: 'CW8.PA', name: 'World' },
    { id: 'i2', symbol: 'MC.PA', name: 'LVMH' },
  ];
  return store;
};

describe('pollCycle', () => {
  it('écrit les nouvelles cotes', async () => {
    const store = setup();
    const provider = { getQuote: async (s: string) => quote(s) };
    const r = await pollCycle({ store, provider, log: silentLogger });
    expect(r.updated).toBe(2);
    expect(store.quotes.get('i1')).toMatchObject({ price: 100, prevClose: 99 });
    expect(r.quotes).toHaveLength(2);
  });

  it("complète le type d'actif fourni par la source", async () => {
    const store = setup();
    store.tracked[1] = { ...store.tracked[1]!, assetType: 'equity' };
    const provider = {
      getQuote: async (s: string) => quote(s, { type: 'etf' }),
    };
    await pollCycle({ store, provider, log: silentLogger });
    expect(store.assetTypes.get('i1')).toBe('etf');
    // déjà connu : pas réécrit
    expect(store.assetTypes.has('i2')).toBe(false);
  });

  it('première cotation : nom et place recalés sur la source', async () => {
    const store = setup();
    store.tracked[0] = { ...store.tracked[0]!, name: 'Nom choisi par un compte' };
    const provider = {
      getQuote: async (s: string) =>
        quote(s, { name: s === 'CW8.PA' ? 'Amundi MSCI World Swap' : 'LVMH', exchange: 'PAR' }),
    };
    const r = await pollCycle({ store, provider, log: silentLogger });
    expect(store.sources.get('i1')).toEqual({ name: 'Amundi MSCI World Swap', exchange: 'PAR' });
    // le nom de la source sert aussi aux alertes du cycle
    expect(r.quotes.find((q) => q.instrument.id === 'i1')!.instrument.name).toBe(
      'Amundi MSCI World Swap',
    );
    // nom déjà identique : rien à écrire
    expect(store.sources.has('i2')).toBe(false);
  });

  it('cote déjà connue : le nom n’est plus modifié', async () => {
    const store = setup();
    store.quotes.set('i1', {
      instrumentId: 'i1',
      price: 100,
      prevClose: 99,
      quotedAt: new Date('2026-09-24T15:30:00Z'),
      fetchedAt: new Date('2026-09-24T15:31:00Z'),
    });
    const provider = { getQuote: async (s: string) => quote(s, { name: 'Autre nom' }) };
    await pollCycle({ store, provider, log: silentLogger });
    expect(store.sources.has('i1')).toBe(false);
  });

  it('source sans nom (secours) : le nom existant est gardé', async () => {
    const store = setup();
    const provider = { getQuote: async (s: string) => quote(s, { name: null }) };
    await pollCycle({ store, provider, log: silentLogger });
    expect(store.sources.size).toBe(0);
  });

  it("n'écrit rien quand la cote n'a pas changé", async () => {
    const store = setup();
    const provider = { getQuote: async (s: string) => quote(s) };
    await pollCycle({ store, provider, log: silentLogger });
    store.upserts = 0;
    const r = await pollCycle({ store, provider, log: silentLogger });
    expect(r.updated).toBe(0);
    expect(store.upserts).toBe(0);
    expect(r.quotes).toHaveLength(2); // toujours transmises aux alertes
  });

  it("écrit quand le prix ou l'heure de cotation change", async () => {
    const store = setup();
    let price = 100;
    const provider = { getQuote: async (s: string) => quote(s, { price }) };
    await pollCycle({ store, provider, log: silentLogger });
    price = 101;
    const r = await pollCycle({ store, provider, log: silentLogger });
    expect(r.updated).toBe(2);
  });

  it("un symbole en échec n'empêche pas les autres", async () => {
    const store = setup();
    const provider = {
      getQuote: async (s: string) => {
        if (s === 'MC.PA') throw new Error('HTTP 503');
        return quote(s);
      },
    };
    const r = await pollCycle({ store, provider, log: silentLogger });
    expect(r.updated).toBe(1);
    expect(r.failed).toEqual([{ symbol: 'MC.PA', error: 'HTTP 503' }]);
  });

  it('rejette une cote hors EUR ou de prix nul', async () => {
    const store = setup();
    const provider = {
      getQuote: async (s: string) =>
        s === 'CW8.PA' ? quote(s, { currency: 'USD' }) : quote(s, { price: 0 }),
    };
    const r = await pollCycle({ store, provider, log: silentLogger });
    expect(r.updated).toBe(0);
    expect(r.failed).toHaveLength(2);
  });

  it('utilise la clôture J-1 de price_history quand Yahoo ne fournit pas la veille', async () => {
    const store = setup();
    store.closes.set('i1', [
      { date: '2026-09-23', close: 95 },
      { date: '2026-09-24', close: 97 },
      { date: '2026-09-25', close: 200 },
    ]);
    const provider = { getQuote: async (s: string) => quote(s, { prevClose: null }) };
    await pollCycle({ store, provider, log: silentLogger });
    expect(store.quotes.get('i1')!.prevClose).toBe(97);
    expect(store.quotes.get('i2')!.prevClose).toBeNull();
  });

  it('aucun instrument suivi : aucun appel', async () => {
    const store = new MemoryStore();
    const provider = {
      getQuote: async () => {
        throw new Error('ne doit pas être appelé');
      },
    };
    expect(await pollCycle({ store, provider, log: silentLogger })).toEqual({
      quotes: [],
      updated: 0,
      failed: [],
    });
  });
});

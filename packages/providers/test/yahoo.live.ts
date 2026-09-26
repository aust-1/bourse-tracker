// Smoke test contre le vrai Yahoo (lancé chaque nuit en CI : détecte une casse de l'API)
import { describe, expect, it } from 'vitest';
import { YahooProvider } from '../src';

const yahoo = new YahooProvider();

describe('Yahoo (live)', () => {
  it.each(['CW8.PA', 'MC.PA', 'SAP.DE'])(
    'cote de %s en EUR avec clôture veille',
    async (symbol) => {
      const q = await yahoo.getQuote(symbol);
      expect(q.currency).toBe('EUR');
      expect(q.price).toBeGreaterThan(0);
      expect(q.prevClose).toBeGreaterThan(0);
      expect(Date.now() - q.quotedAt.getTime()).toBeLessThan(10 * 24 * 3600 * 1000);
    },
  );

  it('historique journalier', async () => {
    const closes = await yahoo.getDailyCloses('CW8.PA', '1mo');
    expect(closes.length).toBeGreaterThan(10);
  });

  it('recherche par nom', async () => {
    const hits = await yahoo.search('amundi msci world');
    expect(hits.some((h) => h.symbol === 'CW8.PA')).toBe(true);
  });
});

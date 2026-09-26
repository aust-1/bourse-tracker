import { describe, expect, it, vi } from 'vitest';
import type { Quote } from '@bourse/providers';
import { Cycle, MAINTENANCE_EVERY_MS } from './cycle';
import { HistoryJob } from './history';
import { silentLogger } from './log';
import { MemoryStore } from './memory-store';
import { SourceMonitor } from './monitor';

const saturday = new Date('2026-09-26T10:00:00Z');
const fridayMorning = new Date('2026-09-25T08:00:00Z'); // 10:00 Paris, séance
const fridayEvening = new Date('2026-09-25T16:30:00Z'); // 18:30 Paris, après la séance

const quote = (symbol: string): Quote => ({
  symbol,
  price: 100,
  prevClose: 99,
  quotedAt: new Date('2026-09-25T15:35:00Z'),
  currency: 'EUR',
  name: symbol,
  exchange: 'PAR',
});

const setup = () => {
  const store = new MemoryStore();
  const provider = {
    getQuote: vi.fn(async (s: string) => quote(s)),
    getDailyCloses: vi.fn(async () => [
      { date: '2026-09-23', close: 98 },
      { date: '2026-09-24', close: 99 },
    ]),
  };
  const notifier = { notify: vi.fn(async () => ({})) };
  const cycle = new Cycle({
    store,
    provider,
    notifier,
    monitor: new SourceMonitor(300_000, saturday),
    history: new HistoryJob({ store, provider, log: silentLogger }),
    log: silentLogger,
    notifyAll: async () => {},
  });
  return { store, provider, cycle };
};

const addInstrument = (store: MemoryStore) => {
  store.tracked = [{ id: 'i1', symbol: 'STM.PA', name: 'STMicroelectronics' }];
  store.firstOrders.set('i1', '2026-09-20');
};

describe('Cycle', () => {
  it('un instrument ajouté un week-end après le démarrage reçoit sa cote et son historique', async () => {
    const { store, provider, cycle } = setup();

    // démarrage du worker : rien à suivre
    await cycle.run(saturday);
    expect(provider.getQuote).not.toHaveBeenCalled();

    // l'utilisateur saisit un ordre : l'instrument devient suivi
    addInstrument(store);

    // moins de 5 minutes plus tard : on ne s'agite pas
    expect((await cycle.run(new Date(saturday.getTime() + 60_000))).ran).toBe(false);
    expect(store.quotes.size).toBe(0);

    // au tour de maintenance suivant : cote initiale et historique
    const later = new Date(saturday.getTime() + MAINTENANCE_EVERY_MS + 1000);
    expect((await cycle.run(later)).ran).toBe(true);
    expect(store.quotes.get('i1')).toMatchObject({ price: 100, prevClose: 99 });
    expect((await store.getHistoryBounds('i1')).min).toBe('2026-09-23');
  });

  it('week-end : les instruments déjà cotés ne sont pas re-cotés', async () => {
    const { store, provider, cycle } = setup();
    addInstrument(store);
    await cycle.run(saturday); // démarrage : cote tout
    provider.getQuote.mockClear();

    await cycle.run(new Date(saturday.getTime() + MAINTENANCE_EVERY_MS + 1000));
    expect(provider.getQuote).not.toHaveBeenCalled();
  });

  it('week-end : rien entre deux tours de maintenance (pas de requêtes inutiles)', async () => {
    const { store, cycle } = setup();
    addInstrument(store);
    await cycle.run(saturday);
    const cyclesBefore = store.cycles.length;
    for (let s = 30; s < 300; s += 30) {
      expect((await cycle.run(new Date(saturday.getTime() + s * 1000))).ran).toBe(false);
    }
    expect(store.cycles.length).toBe(cyclesBefore);
  });

  it('en séance : cote tous les instruments à chaque cycle', async () => {
    const { store, provider, cycle } = setup();
    addInstrument(store);
    await cycle.run(fridayMorning);
    await cycle.run(new Date(fridayMorning.getTime() + 30_000));
    expect(provider.getQuote).toHaveBeenCalledTimes(2);
  });

  it("en soirée : pas de cotes, mais l'historique et le résumé restent servis", async () => {
    const { store, provider, cycle } = setup();
    addInstrument(store);
    await cycle.run(fridayMorning);
    provider.getQuote.mockClear();
    provider.getDailyCloses.mockClear();

    expect((await cycle.run(fridayEvening)).ran).toBe(true);
    expect(provider.getQuote).not.toHaveBeenCalled();
    // le rafraîchissement d'historique de 18:00 a eu lieu
    expect(provider.getDailyCloses).toHaveBeenCalled();
  });

  it("un échec de récupération n'empêche pas les cycles suivants", async () => {
    const { store, provider, cycle } = setup();
    addInstrument(store);
    provider.getQuote.mockRejectedValueOnce(new Error('HTTP 503'));
    await cycle.run(saturday);
    expect(store.quotes.size).toBe(0);
    // la maintenance suivante retente : l'instrument n'a toujours pas de cote
    await cycle.run(new Date(saturday.getTime() + MAINTENANCE_EVERY_MS + 1000));
    expect(store.quotes.get('i1')).toBeDefined();
  });
});

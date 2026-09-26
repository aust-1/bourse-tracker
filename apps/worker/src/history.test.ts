import { describe, expect, it, vi } from 'vitest';
import type { DailyClose } from '@bourse/providers';
import { HistoryJob, historyRange } from './history';
import { silentLogger } from './log';
import { MemoryStore } from './memory-store';
import type { FreshQuote } from './poll';

const inst = { id: 'i1', symbol: 'CW8.PA', name: 'World' };

const setup = (rows: DailyClose[] = []) => {
  const store = new MemoryStore();
  store.tracked = [inst];
  store.firstOrders.set('i1', '2026-01-05');
  const getDailyCloses = vi.fn(async () => rows);
  const job = new HistoryJob({ store, provider: { getDailyCloses }, log: silentLogger });
  return { store, getDailyCloses, job };
};

const monday10h = new Date('2026-09-21T08:00:00Z'); // 10:00 Paris, séance
const monday1745 = new Date('2026-09-21T15:45:00Z'); // 17:45 Paris
const monday18h05 = new Date('2026-09-21T16:05:00Z'); // 18:05 Paris

describe('historyRange', () => {
  it('choisit la plus petite période couvrant le premier ordre', () => {
    const now = new Date('2026-09-26T00:00:00Z');
    expect(historyRange('2026-09-10', now)).toBe('1mo');
    expect(historyRange('2026-03-01', now)).toBe('1y');
    expect(historyRange('2020-01-01', now)).toBe('max');
  });
});

describe('HistoryJob', () => {
  const rows: DailyClose[] = [
    { date: '2026-01-05', close: 100 },
    { date: '2026-01-06', close: 101 },
  ];

  it("remplit l'historique manquant avec la bonne période", async () => {
    const { store, getDailyCloses, job } = setup(rows);
    await job.tick(monday10h, []);
    expect(getDailyCloses).toHaveBeenCalledWith('CW8.PA', '1y');
    expect((await store.getHistoryBounds('i1')).min).toBe('2026-01-05');
  });

  it('ne refait pas un remplissage déjà couvert', async () => {
    const { store, getDailyCloses, job } = setup(rows);
    await store.upsertCloses([{ instrumentId: 'i1', date: '2026-01-05', close: 100 }]);
    await job.tick(monday10h, []);
    // seul le rafraîchissement de démarrage (1mo) a lieu, pas de remplissage 1y
    expect(getDailyCloses).toHaveBeenCalledTimes(1);
    expect(getDailyCloses).toHaveBeenCalledWith('CW8.PA', '1mo');
  });

  it("ne redemande pas l'historique à chaque cycle (même si Yahoo n'a rien de plus)", async () => {
    const { getDailyCloses, job } = setup([{ date: '2026-03-01', close: 90 }]); // plus récent que le 1er ordre
    await job.tick(monday10h, []);
    await job.tick(monday10h, []);
    await job.tick(monday10h, []);
    const backfills = getDailyCloses.mock.calls.filter((c) => (c as unknown[])[1] === '1y');
    expect(backfills).toHaveLength(1);
  });

  it('un nouvel ordre plus ancien relance un remplissage', async () => {
    const { store, getDailyCloses, job } = setup(rows);
    await job.tick(monday10h, []);
    store.firstOrders.set('i1', '2025-06-01');
    await store.getHistoryBounds('i1');
    getDailyCloses.mockResolvedValue([{ date: '2025-06-02', close: 80 }, ...rows]);
    await job.tick(monday10h, []);
    expect(getDailyCloses).toHaveBeenCalledWith('CW8.PA', 'max');
    expect((await store.getHistoryBounds('i1')).min).toBe('2025-06-02');
  });

  it("écarte la clôture du jour tant que la séance n'est pas finie", async () => {
    const today = { date: '2026-09-21', close: 999 };
    const { store, job } = setup([...rows, today]);
    await job.tick(monday10h, []);
    expect((await store.getHistoryBounds('i1')).max).toBe('2026-01-06');
  });

  it("en cas d'échec du fournisseur, retente au cycle suivant", async () => {
    const { store, getDailyCloses, job } = setup(rows);
    getDailyCloses
      .mockRejectedValueOnce(new Error('HTTP 503'))
      .mockRejectedValueOnce(new Error('HTTP 503'));
    await job.tick(monday10h, []);
    expect((await store.getHistoryBounds('i1')).min).toBeNull();
    getDailyCloses.mockResolvedValue(rows);
    await job.tick(monday10h, []);
    expect((await store.getHistoryBounds('i1')).min).toBe('2026-01-05');
  });

  it("enregistre la clôture du jour depuis la cote de l'enchère de clôture", async () => {
    const { store, job } = setup(rows);
    await job.tick(monday10h, []);
    const closing: FreshQuote = {
      instrument: inst,
      price: 705.5,
      prevClose: 700,
      quotedAt: new Date('2026-09-21T15:35:00Z'), // 17:35 Paris
    };
    await job.tick(monday1745, [closing]);
    const today = store.closes.get('i1')!.find((c) => c.date === '2026-09-21');
    expect(today?.close).toBe(705.5);
  });

  it("ignore une cote qui n'est pas celle de la clôture", async () => {
    const { store, job } = setup(rows);
    await job.tick(monday10h, []);
    const midDay: FreshQuote = {
      instrument: inst,
      price: 703,
      prevClose: 700,
      quotedAt: new Date('2026-09-21T12:00:00Z'),
    };
    await job.tick(monday1745, [midDay]);
    expect(store.closes.get('i1')!.some((c) => c.date === '2026-09-21')).toBe(false);
  });

  it('rafraîchit une fois au démarrage puis une fois après 18:00', async () => {
    const { getDailyCloses, job } = setup(rows);
    await job.tick(monday10h, []); // remplissage 1y + rafraîchissement de démarrage
    await job.tick(monday10h, []);
    const recent = () =>
      getDailyCloses.mock.calls.filter((c) => (c as unknown[])[1] === '1mo').length;
    expect(recent()).toBe(1);
    await job.tick(monday18h05, []);
    expect(recent()).toBe(2);
    await job.tick(monday18h05, []);
    expect(recent()).toBe(2);
  });

  it('ignore les instruments sans ordre (alerte seule)', async () => {
    const { store, getDailyCloses, job } = setup(rows);
    store.firstOrders.clear();
    await job.tick(monday10h, []);
    expect(getDailyCloses).not.toHaveBeenCalled();
  });
});

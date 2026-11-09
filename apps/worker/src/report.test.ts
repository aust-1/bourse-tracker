import { describe, expect, it, vi } from 'vitest';
import type { Delivery, Message } from '@bourse/providers';
import { silentLogger } from './log';
import { MemoryStore } from './memory-store';
import { reportFigures, reportMessage, sendPeriodicReports, type ReportInput } from './report';

const norm = (s: string) => s.replace(/\s+/g, ' ');

const order = (instrumentId: string, quantity: number, unitPrice: number, executedAt: string) => ({
  id: `${instrumentId}-${executedAt}`,
  instrumentId,
  side: 'buy' as const,
  quantity,
  unitPrice,
  fees: 0,
  executedAt,
});

// semaine du 21 au 25 septembre 2026 ; base : vendredi 18
const input = (o: Partial<ReportInput> = {}): ReportInput => ({
  period: 'weekly',
  baseDay: '2026-09-18',
  day: '2026-09-25',
  orders: [order('a', 10, 100, '2026-09-01T09:00:00Z'), order('b', 10, 50, '2026-09-01T09:00:00Z')],
  closes: [
    { instrumentId: 'a', date: '2026-09-18', close: 100 },
    { instrumentId: 'b', date: '2026-09-18', close: 50 },
    { instrumentId: 'a', date: '2026-09-22', close: 104 },
  ],
  prices: new Map([
    ['a', 110],
    ['b', 45],
  ]),
  names: new Map([
    ['a', 'World'],
    ['b', 'LVMH'],
  ]),
  income: [],
  events: [],
  ...o,
});

describe('reportFigures', () => {
  it('valeurs, gain hors apports, TWR, meilleure et pire ligne', () => {
    const f = reportFigures(input());
    expect(f.startValue).toBe(1500);
    expect(f.endValue).toBe(1550); // 10 × 110 + 10 × 45
    expect(f.gain).toBe(50);
    expect(f.contributions).toBe(0);
    expect(f.twrPct).toBeCloseTo((1550 / 1500 - 1) * 100, 9);
    expect(f.best).toEqual({ name: 'World', pct: expect.closeTo(10, 9) });
    expect(f.worst).toEqual({ name: 'LVMH', pct: expect.closeTo(-10, 9) });
  });

  it('un achat pendant la période est un apport, pas un gain ; dividendes comptés', () => {
    const f = reportFigures(
      input({
        orders: [...input().orders, order('a', 5, 104, '2026-09-22T09:00:00Z')],
        income: [{ date: '2026-09-23', amount: 12 }],
      }),
    );
    expect(f.contributions).toBe(520 - 12);
    expect(f.endValue).toBe(15 * 110 + 450);
    expect(f.income).toBe(12);
    expect(f.gain).toBeCloseTo(f.endValue - 1500 - (520 - 12), 9);
  });
});

describe('reportMessage', () => {
  it('titre et lignes principales', () => {
    const i = input();
    const m = reportMessage(i, reportFigures(i));
    expect(m.title).toBe('🗓️ Rapport hebdomadaire');
    expect(norm(m.body)).toContain('Du 18/09/2026 au 25/09/2026');
    expect(norm(m.body)).toContain('Gain hors apports : +50,00 €');
    expect(norm(m.body)).toContain('Meilleure ligne : World (+10,00 %)');
  });
});

describe('sendPeriodicReports', () => {
  const friday1800 = new Date('2026-09-25T16:00:00Z');
  const setup = (frequency: 'weekly' | 'monthly' | null) => {
    const store = new MemoryStore();
    store.settings = [
      {
        userId: 'u1',
        discordWebhookUrl: 'https://discord.com/api/webhooks/1/x',
        email: null,
        summaryEnabled: true,
        summaryTime: '17:45',
        lastSummaryOn: null,
        reportFrequency: frequency,
        lastReportOn: null,
      },
    ];
    store.tracked = [{ id: 'a', symbol: 'CW8.PA', name: 'World' }];
    store.orders = [{ ...order('a', 10, 100, '2026-09-01T09:00:00Z'), userId: 'u1' }];
    store.closes.set('a', [{ date: '2026-09-18', close: 100 }]);
    store.quotes.set('a', {
      instrumentId: 'a',
      price: 110,
      prevClose: 105,
      quotedAt: new Date('2026-09-25T15:30:00Z'),
      fetchedAt: new Date(),
    });
    return store;
  };
  const notifier = () => ({
    notify: vi.fn(async (_s: unknown, _c: readonly string[], _m: Message): Promise<Delivery> => ({
      discord: 'sent',
    })),
  });

  it('hebdomadaire : envoyé le vendredi, une seule fois', async () => {
    const store = setup('weekly');
    const n = notifier();
    expect(
      (await sendPeriodicReports({ store, notifier: n, log: silentLogger, now: friday1800 })).sent,
    ).toBe(1);
    expect(norm(n.notify.mock.calls[0]![2].body)).toContain('+100,00 €');
    expect(
      (await sendPeriodicReports({ store, notifier: n, log: silentLogger, now: friday1800 })).sent,
    ).toBe(0);
    expect(store.reportsSent).toEqual([{ userId: 'u1', day: '2026-09-25' }]);
  });

  it('mensuel : pas avant le dernier jour de bourse du mois', async () => {
    const store = setup('monthly');
    expect(
      (
        await sendPeriodicReports({
          store,
          notifier: notifier(),
          log: silentLogger,
          now: friday1800,
        })
      ).sent,
    ).toBe(0);
  });

  it('aucun rapport choisi', async () => {
    const store = setup(null);
    expect(
      (
        await sendPeriodicReports({
          store,
          notifier: notifier(),
          log: silentLogger,
          now: friday1800,
        })
      ).sent,
    ).toBe(0);
  });
});

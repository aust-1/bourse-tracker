import { describe, expect, it, vi } from 'vitest';
import type { Delivery, Message } from '@bourse/providers';
import { silentLogger } from './log';
import { MemoryStore } from './memory-store';
import { sendDailySummaries, summaryMessage, timeToMinutes } from './summary';

const norm = (s: string) => s.replace(/\s+/g, ' ');
const day = '2026-09-25';
const after = new Date('2026-09-25T15:50:00Z'); // 17:50 Paris
const before = new Date('2026-09-25T15:30:00Z'); // 17:30 Paris

const notifierReturning = (d: Delivery) => ({
  notify: vi.fn(async (_s: unknown, _c: readonly string[], _m: Message) => d),
});

const setup = () => {
  const store = new MemoryStore();
  store.tracked = [
    { id: 'a', symbol: 'CW8.PA', name: 'World' },
    { id: 'b', symbol: 'MC.PA', name: 'LVMH' },
  ];
  store.orders = [
    {
      id: '1',
      userId: 'u',
      instrumentId: 'a',
      side: 'buy',
      quantity: 10,
      unitPrice: 100,
      fees: 0,
      executedAt: '2026-01-05T10:00:00Z',
    },
    {
      id: '2',
      userId: 'u',
      instrumentId: 'b',
      side: 'buy',
      quantity: 2,
      unitPrice: 400,
      fees: 0,
      executedAt: '2026-01-05T10:00:00Z',
    },
  ];
  const quotedAt = new Date('2026-09-25T15:35:00Z');
  store.quotes.set('a', {
    instrumentId: 'a',
    price: 110,
    prevClose: 108,
    quotedAt,
    fetchedAt: quotedAt,
  });
  store.quotes.set('b', {
    instrumentId: 'b',
    price: 396,
    prevClose: 400,
    quotedAt,
    fetchedAt: quotedAt,
  });
  store.settings = [
    {
      userId: 'u',
      discordWebhookUrl: 'https://discord.com/api/webhooks/1/x',
      email: null,
      summaryEnabled: true,
      summaryTime: '17:45:00',
      lastSummaryOn: null,
    },
  ];
  return store;
};

describe('timeToMinutes', () => {
  it('convertit HH:MM et HH:MM:SS', () => {
    expect(timeToMinutes('17:45')).toBe(1065);
    expect(timeToMinutes('17:45:00')).toBe(1065);
  });
});

describe('sendDailySummaries', () => {
  it('envoie le résumé après l’heure choisie et le consigne', async () => {
    const store = setup();
    const notifier = notifierReturning({ discord: 'sent' });
    const r = await sendDailySummaries({ store, notifier, log: silentLogger, now: after });
    expect(r.sent).toBe(1);
    expect(store.summariesSent).toEqual([{ userId: 'u', day }]);
    const msg = notifier.notify.mock.calls[0]![2];
    expect(msg.title).toBe('📊 Résumé du 25/09/2026');
    expect(norm(msg.body)).toContain('Valeur : 1 892,00 €');
    expect(norm(msg.body)).toContain('Variation du jour : +12,00 €');
    expect(msg.body).toContain('Meilleure ligne : World');
    expect(msg.body).toContain('Pire ligne : LVMH');
    expect(msg.body).toContain('Aucune alerte déclenchée');
  });

  it('une seule fois par jour', async () => {
    const store = setup();
    const notifier = notifierReturning({ discord: 'sent' });
    const deps = { store, notifier, log: silentLogger, now: after };
    await sendDailySummaries(deps);
    await sendDailySummaries(deps);
    expect(notifier.notify).toHaveBeenCalledTimes(1);
  });

  it('pas avant l’heure choisie', async () => {
    const store = setup();
    const notifier = notifierReturning({ discord: 'sent' });
    await sendDailySummaries({ store, notifier, log: silentLogger, now: before });
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('désactivé : rien', async () => {
    const store = setup();
    store.settings[0]!.summaryEnabled = false;
    const notifier = notifierReturning({ discord: 'sent' });
    await sendDailySummaries({ store, notifier, log: silentLogger, now: after });
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('jour sans cotation (férié) : rien', async () => {
    const store = setup();
    for (const q of store.quotes.values()) q.quotedAt = new Date('2026-09-24T15:35:00Z');
    const notifier = notifierReturning({ discord: 'sent' });
    await sendDailySummaries({ store, notifier, log: silentLogger, now: after });
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('week-end : rien', async () => {
    const store = setup();
    const notifier = notifierReturning({ discord: 'sent' });
    await sendDailySummaries({
      store,
      notifier,
      log: silentLogger,
      now: new Date('2026-09-26T15:50:00Z'),
    });
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('sans ordre : rien', async () => {
    const store = setup();
    store.orders = [];
    const notifier = notifierReturning({ discord: 'sent' });
    await sendDailySummaries({ store, notifier, log: silentLogger, now: after });
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('échec de tous les canaux : non consigné, retenté ensuite', async () => {
    const store = setup();
    const failing = notifierReturning({ discord: 'error: Discord HTTP 500' });
    await sendDailySummaries({ store, notifier: failing, log: silentLogger, now: after });
    expect(store.summariesSent).toHaveLength(0);
    const ok = notifierReturning({ discord: 'sent' });
    await sendDailySummaries({ store, notifier: ok, log: silentLogger, now: after });
    expect(store.summariesSent).toHaveLength(1);
  });

  it('liste les alertes déclenchées aujourd’hui', async () => {
    const store = setup();
    store.alertEvents = [
      {
        userId: 'u',
        type: 'price_above',
        threshold: 105,
        instrumentName: 'World',
        value: 106,
        triggeredAt: new Date('2026-09-25T10:00:00Z'),
      },
      {
        userId: 'u',
        type: 'price_below',
        threshold: 90,
        instrumentName: 'Ancienne',
        value: 89,
        triggeredAt: new Date('2026-09-24T10:00:00Z'),
      },
    ];
    const notifier = notifierReturning({ discord: 'sent' });
    await sendDailySummaries({ store, notifier, log: silentLogger, now: after });
    const body = norm(notifier.notify.mock.calls[0]![2].body);
    expect(body).toContain('Alertes déclenchées aujourd’hui : 1');
    expect(body).toContain('• World : cours ≥ 105,00 €');
    expect(body).not.toContain('Ancienne');
  });
});

describe('summaryMessage', () => {
  it('signale les lignes sans cotation', () => {
    const view = {
      rows: [],
      totals: {
        marketValue: 1000,
        costBasis: 1000,
        unrealizedPl: 0,
        unrealizedPlPct: 0,
        dayPl: 0,
        dayPlPct: null,
        realizedPl: 0,
        missingQuotes: 2,
        sessionDate: null,
      },
    };
    expect(summaryMessage(day, view, []).body).toContain('2 ligne(s) sans cotation');
  });
});

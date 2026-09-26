import { describe, expect, it, vi } from 'vitest';
import { evaluateAlerts } from './alerts';
import { silentLogger } from './log';
import { MemoryStore } from './memory-store';
import type { Delivery, Message } from '@bourse/providers';
import type { FreshQuote } from './poll';

const inSession = new Date('2026-09-25T10:00:00Z');
const weekend = new Date('2026-09-26T10:00:00Z');

const inst = { id: 'i1', symbol: 'CW8.PA', name: 'Amundi World' };
const quote = (price: number, prevClose: number | null = 100): FreshQuote => ({
  instrument: inst,
  price,
  prevClose,
  quotedAt: inSession,
});

const setup = (type: 'price_above' | 'day_change_up' | 'position_pl_above', threshold: number) => {
  const store = new MemoryStore();
  store.alerts = [
    {
      id: 'a1',
      userId: 'u1',
      instrumentId: 'i1',
      type,
      threshold,
      channels: ['discord', 'email'],
      status: 'active',
    },
  ];
  store.settings = [
    {
      userId: 'u1',
      discordWebhookUrl: 'https://discord.com/api/webhooks/1/x',
      email: 'me@example.com',
      summaryEnabled: true,
      summaryTime: '17:45',
      lastSummaryOn: null,
    },
  ];
  return store;
};

const notifierReturning = (d: Delivery) => ({
  notify: vi.fn(async (_s: unknown, _c: readonly string[], _m: Message) => d),
});

describe('evaluateAlerts', () => {
  it("déclenche une alerte de prix, envoie et enregistre l'événement", async () => {
    const store = setup('price_above', 105);
    const notifier = notifierReturning({ discord: 'sent', email: 'sent' });
    const r = await evaluateAlerts([quote(106)], {
      store,
      notifier,
      log: silentLogger,
      now: inSession,
    });
    expect(r.triggered).toBe(1);
    expect(store.alerts[0]!.status).toBe('triggered');
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({ alertId: 'a1', value: 106 });
    const msg = notifier.notify.mock.calls[0]![2];
    expect(msg.title).toContain('Amundi World');
    expect(msg.title.replace(/\s+/g, ' ')).toContain('105,00');
  });

  it("ne se déclenche qu'une seule fois", async () => {
    const store = setup('price_above', 105);
    const notifier = notifierReturning({ discord: 'sent' });
    const deps = { store, notifier, log: silentLogger, now: inSession };
    await evaluateAlerts([quote(106)], deps);
    await evaluateAlerts([quote(107)], deps);
    expect(notifier.notify).toHaveBeenCalledTimes(1);
    expect(store.events).toHaveLength(1);
  });

  it('ne fait rien tant que la condition est fausse', async () => {
    const store = setup('price_above', 105);
    const notifier = notifierReturning({ discord: 'sent' });
    await evaluateAlerts([quote(104.99)], { store, notifier, log: silentLogger, now: inSession });
    expect(notifier.notify).not.toHaveBeenCalled();
    expect(store.alerts[0]!.status).toBe('active');
  });

  it('variation du jour', async () => {
    const store = setup('day_change_up', 5);
    const notifier = notifierReturning({ discord: 'sent' });
    await evaluateAlerts([quote(105.5, 100)], {
      store,
      notifier,
      log: silentLogger,
      now: inSession,
    });
    expect(store.alerts[0]!.status).toBe('triggered');
  });

  it('gain sur position : utilise le PRU calculé depuis les ordres', async () => {
    const store = setup('position_pl_above', 10);
    store.orders = [
      {
        id: 'o1',
        userId: 'u1',
        instrumentId: 'i1',
        side: 'buy',
        quantity: 10,
        unitPrice: 100,
        fees: 0,
        executedAt: '2026-01-05T10:00:00Z',
      },
    ];
    const notifier = notifierReturning({ discord: 'sent' });
    const deps = { store, notifier, log: silentLogger, now: inSession };
    await evaluateAlerts([quote(109.9)], deps);
    expect(store.alerts[0]!.status).toBe('active');
    await evaluateAlerts([quote(110)], deps);
    expect(store.alerts[0]!.status).toBe('triggered');
  });

  it('gain sur position sans position ouverte : jamais déclenchée', async () => {
    const store = setup('position_pl_above', 1);
    const notifier = notifierReturning({ discord: 'sent' });
    await evaluateAlerts([quote(500)], { store, notifier, log: silentLogger, now: inSession });
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('échec de tous les canaux : alerte remise en active, aucun événement', async () => {
    const store = setup('price_above', 105);
    const notifier = notifierReturning({
      discord: 'error: Discord HTTP 500',
      email: 'error: Resend HTTP 500',
    });
    const r = await evaluateAlerts([quote(106)], {
      store,
      notifier,
      log: silentLogger,
      now: inSession,
    });
    expect(r.triggered).toBe(0);
    expect(store.alerts[0]!.status).toBe('active');
    expect(store.events).toHaveLength(0);
  });

  it('succès partiel : enregistrée avec le détail par canal', async () => {
    const store = setup('price_above', 105);
    const notifier = notifierReturning({ discord: 'sent', email: 'error: Resend HTTP 500' });
    await evaluateAlerts([quote(106)], { store, notifier, log: silentLogger, now: inSession });
    expect(store.alerts[0]!.status).toBe('triggered');
    expect(store.events[0]!.delivery).toEqual({ discord: 'sent', email: 'error: Resend HTTP 500' });
  });

  it("aucun canal configuré : consignée dans l'historique, pas de boucle de retry", async () => {
    const store = setup('price_above', 105);
    const notifier = notifierReturning({ discord: 'not_configured', email: 'not_configured' });
    await evaluateAlerts([quote(106)], { store, notifier, log: silentLogger, now: inSession });
    expect(store.alerts[0]!.status).toBe('triggered');
    expect(store.events).toHaveLength(1);
  });

  it('hors séance : les cotes de la veille ne déclenchent rien', async () => {
    const store = setup('price_above', 105);
    const notifier = notifierReturning({ discord: 'sent' });
    await evaluateAlerts([quote(200)], { store, notifier, log: silentLogger, now: weekend });
    expect(notifier.notify).not.toHaveBeenCalled();
    expect(store.alerts[0]!.status).toBe('active');
  });

  it('alerte sur un instrument sans cote ce cycle : ignorée', async () => {
    const store = setup('price_above', 105);
    store.alerts[0]!.instrumentId = 'other';
    const notifier = notifierReturning({ discord: 'sent' });
    await evaluateAlerts([quote(200)], { store, notifier, log: silentLogger, now: inSession });
    expect(notifier.notify).not.toHaveBeenCalled();
  });
});

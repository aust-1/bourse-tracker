// Test d'intégration : nécessite `supabase start` (lancer avec INTEGRATION=1)
import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Database } from '@bourse/db';
import { Notifier, type Quote } from '@bourse/providers';
import { SERVICE_ROLE_KEY, SUPABASE_URL } from '../../../e2e/env';
import { evaluateAlerts } from './alerts';
import { HistoryJob } from './history';
import { silentLogger } from './log';
import { pollCycle } from './poll';
import { SupabaseStore } from './supabase-store';

const db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

describe.skipIf(!process.env.INTEGRATION)('SupabaseStore + pollCycle (base locale)', () => {
  let instrumentId: string;
  let userId: string;

  beforeAll(async () => {
    await db.from('alerts').delete().not('id', 'is', null);
    await db.from('orders').delete().not('id', 'is', null);
    await db.from('quotes_latest').delete().not('instrument_id', 'is', null);
    await db.from('price_history').delete().not('instrument_id', 'is', null);
    await db.from('instruments').delete().not('id', 'is', null);

    const users = await db.auth.admin.listUsers();
    userId =
      users.data.users.find((u) => u.email === 'int@bourse.local')?.id ??
      (
        await db.auth.admin.createUser({
          email: 'int@bourse.local',
          password: 'int-password-123',
          email_confirm: true,
        })
      ).data.user!.id;

    const inst = await db
      .from('instruments')
      .insert({ yahoo_symbol: 'CW8.PA', name: 'World', exchange: 'PAR' })
      .select('id')
      .single();
    instrumentId = inst.data!.id;
    await db
      .from('instruments')
      .insert({ yahoo_symbol: 'IGN.PA', name: 'Ignoré', exchange: 'PAR' });
    await db.from('orders').insert({
      user_id: userId,
      instrument_id: instrumentId,
      side: 'buy',
      quantity: 1,
      unit_price: 100,
      executed_at: '2026-01-05T10:00:00Z',
    });
    await db
      .from('price_history')
      .insert([{ instrument_id: instrumentId, date: '2026-09-24', close: 97 }]);
  });

  it('ne suit que les instruments avec ordre ou alerte active', async () => {
    const tracked = await new SupabaseStore(db).listTrackedInstruments();
    expect(tracked.map((t) => t.symbol)).toEqual(['CW8.PA']);
  });

  it('écrit la cote, applique le repli J-1 et ne réécrit pas si inchangée', async () => {
    const store = new SupabaseStore(db);
    const provider = {
      getQuote: async (symbol: string): Promise<Quote> => ({
        symbol,
        price: 101.5,
        prevClose: null,
        quotedAt: new Date('2026-09-25T15:35:00Z'),
        currency: 'EUR',
        name: null,
        exchange: null,
      }),
    };
    const first = await pollCycle({ store, provider, log: silentLogger });
    expect(first.updated).toBe(1);

    const quote = (await store.getQuotes([instrumentId])).get(instrumentId)!;
    expect(quote.price).toBe(101.5);
    expect(quote.prevClose).toBe(97);
    expect(quote.quotedAt.toISOString()).toBe('2026-09-25T15:35:00.000Z');

    const second = await pollCycle({ store, provider, log: silentLogger });
    expect(second.updated).toBe(0);
  });

  it('enregistre le statut du cycle', async () => {
    await new SupabaseStore(db).recordCycle({ error: 'test' });
    const { data } = await db.from('worker_status').select('*').eq('id', 1).single();
    expect(data?.last_error).toBe('test');
    expect(data?.last_cycle_at).not.toBeNull();
  });

  it("prise atomique d'une alerte : un seul cycle gagne, événement enregistré", async () => {
    const store = new SupabaseStore(db);
    const alert = await db
      .from('alerts')
      .insert({
        user_id: userId,
        instrument_id: instrumentId,
        type: 'price_above',
        threshold: 100,
        channels: ['discord'],
      })
      .select('id')
      .single();
    const id = alert.data!.id;

    expect((await store.listActiveAlerts()).map((a) => a.id)).toContain(id);
    const [a, b] = await Promise.all([
      store.claimAlert(id, new Date()),
      store.claimAlert(id, new Date()),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect((await store.listActiveAlerts()).map((x) => x.id)).not.toContain(id);

    await store.recordAlertEvent({
      alertId: id,
      userId,
      value: 101,
      delivery: { discord: 'sent' },
    });
    const ev = await db.from('alert_events').select('*').eq('alert_id', id).single();
    expect(ev.data).toMatchObject({ value_at_trigger: 101, delivery: { discord: 'sent' } });

    await store.releaseAlert(id);
    expect((await store.listActiveAlerts()).map((x) => x.id)).toContain(id);
  });

  it("lit les ordres d'un utilisateur", async () => {
    const orders = await new SupabaseStore(db).getOrders(userId, instrumentId);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ side: 'buy', quantity: 1, unitPrice: 100 });
  });

  it('pipeline complet : cote → alerte → Discord (simulé) → statut et historique en base', async () => {
    const store = new SupabaseStore(db);
    await db.from('alerts').delete().not('id', 'is', null);
    await db.from('settings').delete().not('user_id', 'is', null);
    await db.from('settings').insert({
      user_id: userId,
      discord_webhook_url: 'https://discord.com/api/webhooks/1/abc',
    });
    const alert = await db
      .from('alerts')
      .insert({
        user_id: userId,
        instrument_id: instrumentId,
        type: 'position_pl_above',
        threshold: 10,
        channels: ['discord'],
      })
      .select('id')
      .single();

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const notifier = new Notifier({ resendApiKey: null, emailFrom: 'x', fetch: fetchMock });
    const fresh = [
      {
        instrument: { id: instrumentId, symbol: 'CW8.PA', name: 'World' },
        price: 111, // PRU 100 -> +11 %
        prevClose: 100,
        quotedAt: new Date('2026-09-25T10:00:00Z'),
      },
    ];
    const now = new Date('2026-09-25T10:00:00Z');
    const r = await evaluateAlerts(fresh, { store, notifier, log: silentLogger, now });
    expect(r.triggered).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://discord.com/api/webhooks/1/abc');

    const row = await db
      .from('alerts')
      .select('status, last_triggered_at')
      .eq('id', alert.data!.id)
      .single();
    expect(row.data?.status).toBe('triggered');
    expect(row.data?.last_triggered_at).not.toBeNull();
    const ev = await db
      .from('alert_events')
      .select('delivery, value_at_trigger')
      .eq('alert_id', alert.data!.id)
      .single();
    expect(ev.data?.delivery).toEqual({ discord: 'sent' });
    expect(ev.data?.value_at_trigger).toBeCloseTo(11, 6);

    // second cycle : rien ne repart
    await evaluateAlerts(fresh, { store, notifier, log: silentLogger, now });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('historique : remplissage par lots, bornes et premier ordre', async () => {
    const store = new SupabaseStore(db);
    await db.from('price_history').delete().eq('instrument_id', instrumentId);

    // 2 500 séances fictives : dépasse la limite de 1 000 lignes par requête
    const rows = Array.from({ length: 2500 }, (_, i) => {
      const d = new Date(Date.UTC(2016, 0, 1) + i * 86_400_000);
      return { date: d.toISOString().slice(0, 10), close: 100 + (i % 50) };
    });
    const provider = { getDailyCloses: vi.fn().mockResolvedValue(rows) };
    const job = new HistoryJob({ store, provider, log: silentLogger });
    await job.tick(new Date('2026-09-25T10:00:00Z'), []);

    expect(provider.getDailyCloses).toHaveBeenCalledWith('CW8.PA', '1y');
    const count = await db
      .from('price_history')
      .select('*', { count: 'exact', head: true })
      .eq('instrument_id', instrumentId);
    expect(count.count).toBe(2500);

    const bounds = await store.getHistoryBounds(instrumentId);
    expect(bounds).toEqual({ min: '2016-01-01', max: rows[2499]!.date });
    expect(await store.getFirstOrderDate(instrumentId)).toBe('2026-01-05');
  });

  it("résumé : ordres de l'utilisateur, événements du jour et consignation", async () => {
    const store = new SupabaseStore(db);
    await db.from('settings').delete().not('user_id', 'is', null);
    await db.from('settings').insert({ user_id: userId, email: 'int@example.com' });
    await db.from('alerts').delete().not('id', 'is', null);
    const alert = await db
      .from('alerts')
      .insert({ user_id: userId, instrument_id: instrumentId, type: 'price_above', threshold: 50 })
      .select('id')
      .single();
    await db.from('alert_events').insert([
      {
        alert_id: alert.data!.id,
        user_id: userId,
        value_at_trigger: 60,
        triggered_at: '2026-09-25T09:00:00Z',
      },
      {
        alert_id: alert.data!.id,
        user_id: userId,
        value_at_trigger: 61,
        triggered_at: '2026-09-20T09:00:00Z',
      },
    ]);

    expect((await store.listUserOrders(userId)).map((o) => o.instrumentId)).toEqual([instrumentId]);

    const events = await store.listAlertEventsSince(userId, new Date('2026-09-24T22:00:00Z'));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'price_above',
      threshold: 50,
      value: 60,
      instrumentName: 'World',
    });

    await store.markSummarySent(userId, '2026-09-25');
    expect((await store.getSettings(userId))?.lastSummaryOn).toBe('2026-09-25');
    expect((await store.listSettings()).map((s) => s.userId)).toContain(userId);
  });
});

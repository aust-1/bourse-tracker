// Test d'intégration : nécessite `supabase start` (lancer avec INTEGRATION=1)
import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@bourse/db';
import type { Quote } from '@bourse/providers';
import { SERVICE_ROLE_KEY, SUPABASE_URL } from '../../../e2e/env';
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
});

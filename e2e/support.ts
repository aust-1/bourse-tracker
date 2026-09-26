import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { SERVICE_ROLE_KEY, SUPABASE_URL, TEST_EMAIL, TEST_PASSWORD } from './env';

export const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const CW8 = { yahoo_symbol: 'CW8.PA', name: 'Amundi MSCI World Swap', exchange: 'PAR' };

/** Base propre : un utilisateur de test, un instrument, aucune donnée perso. */
export async function resetData() {
  for (const t of [
    'alert_events',
    'alerts',
    'orders',
    'portfolio_snapshots',
    'settings',
  ] as const) {
    const col = t === 'alert_events' || t === 'alerts' || t === 'orders' ? 'id' : 'user_id';
    const { error } = await admin.from(t).delete().not(col, 'is', null);
    if (error) throw error;
  }
  await admin.from('quotes_latest').delete().not('instrument_id', 'is', null);
  await admin.from('price_history').delete().not('instrument_id', 'is', null);
  await admin.from('instruments').delete().not('id', 'is', null);

  const list = await admin.auth.admin.listUsers();
  let user = list.data.users.find((u) => u.email === TEST_EMAIL);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    user = created.data.user;
  }
  const inst = await admin.from('instruments').insert(CW8).select('id').single();
  if (inst.error) throw inst.error;
  return { userId: user.id, instrumentId: inst.data.id };
}

export async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(TEST_EMAIL);
  await page.getByPlaceholder('Mot de passe').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('/');
}

/** La recherche Yahoo est simulée côté navigateur : l'e2e ne dépend pas du réseau. */
export async function mockInstrumentSearch(page: Page) {
  await page.route('**/api/instruments/search*', (route) =>
    route.fulfill({
      json: {
        hits: [
          {
            symbol: CW8.yahoo_symbol,
            name: CW8.name,
            exchange: 'PAR',
            exchangeName: 'Paris',
            type: 'ETF',
          },
        ],
      },
    }),
  );
}

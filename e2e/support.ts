import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { MAILPIT_URL, SERVICE_ROLE_KEY, SUPABASE_URL, TEST_EMAIL, TEST_PASSWORD } from './env';
import { ensureUser } from './users';

export const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const CW8 = { yahoo_symbol: 'CW8.PA', name: 'Amundi MSCI World Swap', exchange: 'PAR' };

/** Base propre : un utilisateur de test, un instrument, aucune donnée perso. */
export async function resetData() {
  for (const t of ['alert_events', 'alerts', 'orders', 'settings'] as const) {
    const col = t === 'alert_events' || t === 'alerts' || t === 'orders' ? 'id' : 'user_id';
    const { error } = await admin.from(t).delete().not(col, 'is', null);
    if (error) throw error;
  }
  await admin.from('quotes_latest').delete().not('instrument_id', 'is', null);
  await admin.from('price_history').delete().not('instrument_id', 'is', null);
  await admin.from('instruments').delete().not('id', 'is', null);

  const userId = await ensureUser(admin, TEST_EMAIL, TEST_PASSWORD);
  // un seul portefeuille (le PEA créé avec le compte), sélecteur absent
  await admin.from('portfolios').delete().eq('user_id', userId).neq('name', 'PEA');
  // pas de double authentification laissée par un parcours précédent
  const factors = await admin.auth.admin.mfa.listFactors({ userId });
  for (const f of factors.data?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
  }
  const inst = await admin.from('instruments').insert(CW8).select('id').single();
  if (inst.error) throw inst.error;
  // l'utilisateur ne voit que les instruments qu'il suit
  const link = await admin
    .from('user_instruments')
    .insert({ user_id: userId, instrument_id: inst.data.id });
  if (link.error) throw link.error;
  return { userId, instrumentId: inst.data.id };
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

/** Vide la boîte Mailpit (emails d'authentification de Supabase local). */
export async function clearMailbox() {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
}

/** Attend le dernier email reçu par `to` et renvoie le premier lien qu'il contient. */
export async function lastEmailLink(to: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const msg = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0]!.ID}`);
      const { HTML, Text } = (await msg.json()) as { HTML: string; Text: string };
      const link = /href="([^"]+)"/.exec(HTML)?.[1] ?? /https?:\/\/\S+/.exec(Text)?.[0];
      if (link) return link.replaceAll('&amp;', '&');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`aucun email reçu par ${to}`);
}

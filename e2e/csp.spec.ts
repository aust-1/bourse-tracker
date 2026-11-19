import { expect, test, type ConsoleMessage } from '@playwright/test';
import { admin, login, resetData } from './support';

const isCspViolation = (m: ConsoleMessage) => /Content Security Policy/i.test(m.text());

test('CSP : en-tête présent, nonce différent à chaque requête', async ({ request }) => {
  const a = await request.get('/login');
  const b = await request.get('/login');
  const csp = a.headers()['content-security-policy'];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  expect(b.headers()['content-security-policy']).not.toBe(csp);
});

test('CSP : aucune violation sur le tableau de bord, l’historique et la fiche du titre', async ({
  page,
}) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'buy',
    quantity: 10,
    unit_price: 100,
    executed_at: '2026-01-05T10:00:00Z',
  });
  await admin.from('quotes_latest').upsert({
    instrument_id: instrumentId,
    price: 110,
    prev_close: 108,
    quoted_at: new Date().toISOString(),
  });
  const violations: string[] = [];
  page.on('console', (m) => {
    if (isCspViolation(m)) violations.push(m.text());
  });

  await login(page);
  // tableau de bord : graphiques, Realtime (WebSocket vers Supabase)
  await expect(page.getByText('Valeur du portefeuille')).toBeVisible();
  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'Historique' })).toBeVisible();
  await page.goto(`/instruments/${instrumentId}`);
  await expect(page.getByRole('heading', { name: 'Ma position' })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();

  expect(violations).toEqual([]);
});

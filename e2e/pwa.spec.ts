import { expect, test } from '@playwright/test';
import { admin, login, resetData } from './support';

test('PWA : manifeste et icônes accessibles sans session', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: 'Bourse Tracker', display: 'standalone', start_url: '/' });
  for (const icon of manifest.icons as { src: string }[]) {
    const img = await request.get(icon.src);
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toBe('image/png');
  }
});

test('téléphone : tableau de bord sans défilement horizontal de la page', async ({ page }) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'buy',
    quantity: 3,
    unit_price: 500,
    executed_at: '2026-01-05T09:30:00Z',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/mobile-dashboard.png', fullPage: true });
});

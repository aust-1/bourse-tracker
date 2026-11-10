import { expect, test } from '@playwright/test';
import { admin, CW8, login, resetData } from './support';

test("supervision : état du worker, échecs et cotes, réservée à l'administrateur", async ({
  page,
}) => {
  const { userId } = await resetData();
  await admin.from('profiles').update({ is_admin: false }).eq('user_id', userId);
  await login(page);
  expect((await page.goto('/supervision'))?.status()).toBe(404);

  await admin.from('profiles').update({ is_admin: true }).eq('user_id', userId);
  const recent = new Date(Date.now() - 60_000).toISOString();
  await admin
    .from('worker_status')
    .update({
      last_cycle_at: recent,
      last_poll_at: recent,
      last_error: null,
      failed: [{ symbol: CW8.yahoo_symbol, error: 'HTTP 503' }],
    })
    .eq('id', 1);

  await page.goto('/');
  await page.getByRole('link', { name: 'Supervision' }).click();
  await expect(page.getByTestId('worker-health')).toContainText('En marche');
  await expect(page.getByText(`${CW8.yahoo_symbol} : HTTP 503`)).toBeVisible();
  // l'instrument suivi n'a pas encore de cote
  const row = page.getByRole('row').filter({ hasText: CW8.name });
  await expect(row.getByText('Aucune cote')).toBeVisible();

  // worker muet depuis une heure
  await admin
    .from('worker_status')
    .update({ last_cycle_at: new Date(Date.now() - 3_600_000).toISOString(), failed: [] })
    .eq('id', 1);
  await page.reload();
  await expect(page.getByTestId('worker-health')).toContainText('Muet');
});

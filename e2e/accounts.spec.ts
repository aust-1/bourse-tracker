import { expect, test, type Page } from '@playwright/test';
import { TEST_EMAIL } from './env';
import { admin, login, resetData } from './support';
import { ensureUser } from './users';

const OTHER_EMAIL = 'autre@bourse.local';
const OTHER_PASSWORD = 'autre-password-123';

async function freshOther() {
  const old = (await admin.auth.admin.listUsers()).data.users.find((u) => u.email === OTHER_EMAIL);
  if (old) await admin.auth.admin.deleteUser(old.id);
  return ensureUser(admin, OTHER_EMAIL, OTHER_PASSWORD);
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test('export de ses données au format JSON', async ({ page }) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'buy',
    quantity: 3,
    unit_price: 500,
    executed_at: '2026-10-01T09:00:00Z',
  });
  await login(page);
  const res = await page.request.get('/settings/export');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-disposition']).toContain('attachment');
  const body = await res.json();
  expect(body.account.email).toBe(TEST_EMAIL);
  expect(body.orders).toHaveLength(1);
  expect(body.orders[0]).toMatchObject({ quantity: 3, unit_price: 500 });
});

test('suppression de son compte : confirmation exigée, données effacées', async ({ page }) => {
  await resetData();
  const otherId = await freshOther();
  await loginAs(page, OTHER_EMAIL, OTHER_PASSWORD);
  await page.waitForURL('/');
  await page.goto('/settings');

  await page.getByLabel(/Tape SUPPRIMER/).fill('non');
  await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Tape SUPPRIMER');

  await page.getByLabel(/Tape SUPPRIMER/).fill('SUPPRIMER');
  await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
  await page.waitForURL('**/login?deleted=1');
  await expect(page.getByRole('status')).toContainText('ont été supprimés');
  expect((await admin.auth.admin.getUserById(otherId)).data.user).toBeNull();
});

test("désactivation par l'administrateur : connexion refusée, puis réactivation", async ({
  page,
  browser,
}) => {
  const { userId } = await resetData();
  await admin.from('profiles').update({ is_admin: true }).eq('user_id', userId);
  await freshOther();

  await login(page);
  await page.getByRole('link', { name: 'Comptes' }).click();
  const row = page.getByRole('row').filter({ hasText: OTHER_EMAIL });
  await expect(row.getByText('Actif')).toBeVisible();
  // pas de bouton sur sa propre ligne
  await expect(
    page.getByRole('row').filter({ hasText: TEST_EMAIL }).getByRole('button'),
  ).toHaveCount(0);
  await row.getByRole('button', { name: 'Désactiver' }).click();
  await expect(row.getByText('Désactivé')).toBeVisible();

  const other = await browser.newPage();
  await loginAs(other, OTHER_EMAIL, OTHER_PASSWORD);
  await expect(other.locator('p[role="alert"]')).toContainText('désactivé');

  await row.getByRole('button', { name: 'Réactiver' }).click();
  await expect(row.getByText('Actif')).toBeVisible();
  await loginAs(other, OTHER_EMAIL, OTHER_PASSWORD);
  await other.waitForURL('/');
});

import { expect, test } from '@playwright/test';
import { admin, CW8, login, resetData } from './support';

test('ISIN : saisie validée, éligibilité au PEA, alerte sur le tableau de bord', async ({
  page,
}) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('profiles').update({ is_admin: false }).eq('user_id', userId);
  await admin.from('orders').insert({
    user_id: userId,
    instrument_id: instrumentId,
    side: 'buy',
    quantity: 1,
    unit_price: 100,
    executed_at: '2026-01-05T09:30:00Z',
  });
  await login(page);
  await page.goto(`/instruments/${instrumentId}`);
  const section = page.getByRole('region', { name: 'Identification' });
  await expect(section.getByTestId('pea-eligibility')).toContainText('ISIN inconnu');

  // clé de contrôle fausse
  await section.getByLabel('Renseigner l’ISIN').fill('US0378331006');
  await section.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('ISIN invalide');

  // ISIN américain : non éligible
  await section.getByLabel('Renseigner l’ISIN').fill('us0378331005');
  await section.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(section.getByTestId('pea-eligibility')).toContainText('non éligible au PEA');
  // un compte non administrateur ne peut plus le modifier
  await expect(section.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0);

  // tableau de bord d'un PEA : le titre est signalé
  await page.goto('/');
  await expect(page.getByRole('row', { name: new RegExp(CW8.name) })).toContainText('hors PEA');
});

test("changement de symbole : réservé à l'administrateur, format vérifié", async ({ page }) => {
  const { userId, instrumentId } = await resetData();
  await admin.from('profiles').update({ is_admin: false }).eq('user_id', userId);
  await login(page);
  await page.goto(`/instruments/${instrumentId}`);
  const section = page.getByRole('region', { name: 'Identification' });
  await expect(section.getByLabel('Nouveau symbole Yahoo')).toHaveCount(0);

  await admin.from('profiles').update({ is_admin: true }).eq('user_id', userId);
  await page.reload();
  await section.getByLabel('Nouveau symbole Yahoo').fill('pas un symbole');
  await section.getByRole('button', { name: 'Changer de symbole' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Symbole invalide');
});

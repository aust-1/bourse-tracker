'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { snapshot, type FormValues } from '@/lib/form-state';
import { canDeletePortfolio, parsePortfolioForm } from '@/lib/portfolio-form';
import { PORTFOLIO_COOKIE } from '@/lib/portfolios';
import { createClient } from '@/lib/supabase/server';

export interface PortfolioFormState {
  error?: string;
  values?: FormValues;
}

/** Choix du portefeuille affiché (« all » = tous). */
export async function selectPortfolio(formData: FormData) {
  const id = String(formData.get('portfolio') ?? 'all');
  const store = await cookies();
  store.set(PORTFOLIO_COOKIE, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 86_400,
  });
  revalidatePath('/', 'layout');
}

export async function savePortfolio(
  id: string | null,
  _prev: PortfolioFormState,
  formData: FormData,
): Promise<PortfolioFormState> {
  const { data, error } = parsePortfolioForm(formData);
  if (!data) return { error, values: snapshot(formData) };

  const supabase = await createClient();
  const row = { name: data.name, kind: data.kind, opened_on: data.openedOn };
  const res = id
    ? await supabase.from('portfolios').update(row).eq('id', id)
    : await supabase.from('portfolios').insert(row);
  if (res.error) {
    const message =
      res.error.code === '23505' ? 'Un portefeuille porte déjà ce nom.' : res.error.message;
    return { error: message, values: snapshot(formData) };
  }
  revalidatePath('/', 'layout');
  redirect('/portfolios');
}

/**
 * Supprime un portefeuille vide. Un portefeuille avec des ordres ou des mouvements d'espèces est
 * refusé : la base effacerait ses mouvements avec lui (versements comptés dans le plafond du PEA).
 */
export async function deletePortfolio(id: string) {
  const supabase = await createClient();
  const count = (table: 'orders' | 'cash_movements') =>
    supabase.from(table).select('id', { count: 'exact', head: true }).eq('portfolio_id', id);
  const [orders, movements, portfolios] = await Promise.all([
    count('orders'),
    count('cash_movements'),
    supabase.from('portfolios').select('id', { count: 'exact', head: true }),
  ]);
  const allowed = canDeletePortfolio({
    orders: orders.error ? null : orders.count,
    movements: movements.error ? null : movements.count,
    portfolios: portfolios.count ?? 0,
  });
  if (!allowed) redirect('/portfolios?notice=not_empty');
  await supabase.from('portfolios').delete().eq('id', id);
  revalidatePath('/', 'layout');
  redirect('/portfolios');
}

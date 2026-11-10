import type { Database } from '@bourse/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { PortfolioKind } from './portfolio-kinds';

export { KIND_LABELS, type PortfolioKind } from './portfolio-kinds';

type Client = SupabaseClient<Database>;

export interface Portfolio {
  id: string;
  name: string;
  kind: PortfolioKind;
  openedOn: string | null;
}

/** Cookie du portefeuille affiché ; absent ou « all » = tous les portefeuilles. */
export const PORTFOLIO_COOKIE = 'portfolio';

export async function loadPortfolios(supabase: Client): Promise<Portfolio[]> {
  const { data, error } = await supabase
    .from('portfolios')
    .select('id, name, kind, opened_on')
    .order('created_at')
    .order('id');
  if (error) throw new Error(error.message);
  return data.map((p) => ({ id: p.id, name: p.name, kind: p.kind, openedOn: p.opened_on }));
}

export interface PortfolioScope {
  portfolios: Portfolio[];
  /** Portefeuille affiché, ou null pour l'ensemble. */
  selected: Portfolio | null;
}

/** Portefeuilles du compte et portefeuille choisi (cookie), validé contre la liste. */
export async function portfolioScope(supabase: Client): Promise<PortfolioScope> {
  const [portfolios, store] = await Promise.all([loadPortfolios(supabase), cookies()]);
  const id = store.get(PORTFOLIO_COOKIE)?.value;
  return { portfolios, selected: portfolios.find((p) => p.id === id) ?? null };
}

'use server';

import { peaMovementWarnings } from '@bourse/core';
import { fetchAll, type Database } from '@bourse/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { parseCashForm, type CashInput } from '@/lib/cash';
import { snapshot, type FormValues } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';

export interface CashFormState {
  error?: string;
  values?: FormValues;
  saved?: number;
  /** Règles du PEA en jeu (plafond, retrait avant 5 ans) : confirmation demandée avant d'enregistrer */
  warnings?: string[];
}

/** Avertissements PEA du mouvement, d'après les portefeuilles et versements du compte. */
async function movementWarnings(
  supabase: SupabaseClient<Database>,
  m: CashInput,
): Promise<string[]> {
  if (m.kind !== 'deposit' && m.kind !== 'withdrawal') return [];
  const [portfolios, deposits] = await Promise.all([
    supabase.from('portfolios').select('id, kind, opened_on'),
    fetchAll((from, to) =>
      supabase
        .from('cash_movements')
        .select('id, portfolio_id, amount')
        .eq('kind', 'deposit')
        .order('id')
        .range(from, to),
    ),
  ]);
  if (portfolios.error) throw new Error(portfolios.error.message);
  const target = portfolios.data.find((p) => p.id === m.portfolioId);
  if (!target) return [];
  const kindOf = new Map(portfolios.data.map((p) => [p.id, p.kind]));
  const totals = { pea: 0, pea_pme: 0 };
  for (const d of deposits) {
    const kind = kindOf.get(d.portfolio_id);
    if (kind === 'pea' || kind === 'pea_pme') totals[kind] += Number(d.amount);
  }
  return peaMovementWarnings({
    kind: m.kind,
    amount: m.amount,
    occurredOn: m.occurredOn,
    portfolio: { kind: target.kind, openedOn: target.opened_on },
    deposits: totals,
  }).map((w) => w.message);
}

export async function addMovement(
  _prev: CashFormState,
  formData: FormData,
): Promise<CashFormState> {
  const { data, error } = parseCashForm(formData);
  if (!data) return { error, values: snapshot(formData) };

  const supabase = await createClient();
  // règles du PEA revérifiées ici : le formulaire les affiche, l'utilisateur confirme
  const warnings = await movementWarnings(supabase, data);
  if (warnings.length > 0 && formData.get('confirm') !== 'on') {
    return { warnings, values: snapshot(formData) };
  }

  const { error: dbError } = await supabase.from('cash_movements').insert({
    portfolio_id: data.portfolioId,
    kind: data.kind,
    amount: data.amount,
    instrument_id: data.instrumentId,
    occurred_on: data.occurredOn,
    note: data.note,
  });
  if (dbError) return { error: `Erreur : ${dbError.message}`, values: snapshot(formData) };

  revalidatePath('/', 'layout');
  return { saved: Date.now() };
}

export async function deleteMovement(id: string) {
  const supabase = await createClient();
  await supabase.from('cash_movements').delete().eq('id', id);
  revalidatePath('/', 'layout');
}

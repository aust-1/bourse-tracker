'use server';

import { revalidatePath } from 'next/cache';
import { parseCashForm } from '@/lib/cash';
import { snapshot, type FormValues } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';

export interface CashFormState {
  error?: string;
  values?: FormValues;
  saved?: number;
}

export async function addMovement(
  _prev: CashFormState,
  formData: FormData,
): Promise<CashFormState> {
  const { data, error } = parseCashForm(formData);
  if (!data) return { error, values: snapshot(formData) };

  const supabase = await createClient();
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

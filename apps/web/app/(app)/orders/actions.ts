'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dbErrorMessage, parseOrderForm } from '@/lib/orders';
import { ensureInstrument } from '@/lib/instruments';
import { snapshot, type FormValues } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';

export interface OrderFormState {
  error?: string;
  /** Valeurs soumises, réutilisées comme valeurs par défaut (cf. lib/form-state.ts) */
  values?: FormValues;
}

export async function saveOrder(
  id: string | null,
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const { data, error } = parseOrderForm(formData);
  if (!data) return { error, values: snapshot(formData) };

  const supabase = await createClient();
  const inst = await ensureInstrument(supabase, data.symbol);
  if (!inst.id) return { error: inst.error, values: snapshot(formData) };

  const row = {
    instrument_id: inst.id,
    side: data.side,
    quantity: data.quantity,
    unit_price: data.unitPrice,
    fees: data.fees,
    executed_at: data.executedAt.toISOString(),
    note: data.note,
  };
  const res = id
    ? await supabase.from('orders').update(row).eq('id', id)
    : await supabase.from('orders').insert(row);
  if (res.error) return { error: dbErrorMessage(res.error), values: snapshot(formData) };

  revalidatePath('/orders');
  revalidatePath('/');
  redirect('/orders');
}

export async function deleteOrder(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) redirect(`/orders/${id}?error=${encodeURIComponent(dbErrorMessage(error))}`);
  revalidatePath('/orders');
  revalidatePath('/');
  redirect('/orders');
}

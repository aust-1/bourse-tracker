'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dbErrorMessage, parseOrderForm } from '@/lib/orders';
import { ensureInstrument } from '@/lib/instruments';
import { createClient } from '@/lib/supabase/server';

export interface OrderFormState {
  error?: string;
}

export async function saveOrder(
  id: string | null,
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const { data, error } = parseOrderForm(formData);
  if (!data) return { error };

  const supabase = await createClient();
  const inst = await ensureInstrument(supabase, data.symbol);
  if (!inst.id) return { error: inst.error };

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
  if (res.error) return { error: dbErrorMessage(res.error) };

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

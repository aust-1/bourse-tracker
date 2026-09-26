'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Database } from '@bourse/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dbErrorMessage, parseOrderForm } from '@/lib/orders';
import { createClient } from '@/lib/supabase/server';
import { yahoo } from '@/lib/yahoo';

export interface OrderFormState {
  error?: string;
}

async function ensureInstrument(
  supabase: SupabaseClient<Database>,
  symbol: string,
): Promise<{ id?: string; error?: string }> {
  const existing = await supabase
    .from('instruments')
    .select('id')
    .eq('yahoo_symbol', symbol)
    .maybeSingle();
  if (existing.data) return { id: existing.data.id };

  let quote;
  try {
    quote = await yahoo.getQuote(symbol);
  } catch {
    return { error: `Instrument introuvable ou source de prix indisponible : ${symbol}` };
  }
  if (quote.currency !== 'EUR') {
    return {
      error: `Seuls les titres cotés en EUR sont acceptés (${symbol} est en ${quote.currency}).`,
    };
  }
  const inserted = await supabase
    .from('instruments')
    .insert({
      yahoo_symbol: symbol,
      name: quote.name ?? symbol,
      exchange: quote.exchange,
      currency: 'EUR',
    })
    .select('id')
    .single();
  if (inserted.error) {
    // course possible avec un autre ajout simultané : on relit
    const again = await supabase
      .from('instruments')
      .select('id')
      .eq('yahoo_symbol', symbol)
      .maybeSingle();
    if (again.data) return { id: again.data.id };
    return { error: dbErrorMessage(inserted.error) };
  }
  return { id: inserted.data.id };
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

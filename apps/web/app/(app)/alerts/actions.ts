'use server';

import { computePosition, evaluateAlert } from '@bourse/core';
import { fetchAll } from '@bourse/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parseAlertForm } from '@/lib/alerts';
import { ensureInstrument } from '@/lib/instruments';
import { dbErrorMessage } from '@/lib/orders';
import { snapshot, type FormValues } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';

export interface AlertFormState {
  error?: string;
  /** Valeurs soumises, réutilisées comme valeurs par défaut (cf. lib/form-state.ts) */
  values?: FormValues;
}

export async function createAlert(
  _prev: AlertFormState,
  formData: FormData,
): Promise<AlertFormState> {
  const { data, error } = parseAlertForm(formData);
  if (!data) return { error, values: snapshot(formData) };

  const supabase = await createClient();
  const inst = await ensureInstrument(supabase, data.symbol);
  if (!inst.id) return { error: inst.error, values: snapshot(formData) };
  const instrumentId = inst.id; // capturé : le rétrécissement de type ne traverse pas les callbacks

  const res = await supabase.from('alerts').insert({
    instrument_id: inst.id,
    type: data.type,
    threshold: data.threshold,
    channels: data.channels,
  });
  if (res.error) return { error: dbErrorMessage(res.error), values: snapshot(formData) };

  // la condition est-elle déjà vraie ? Elle partirait alors au prochain cycle en séance.
  const [quote, orders] = await Promise.all([
    supabase
      .from('quotes_latest')
      .select('price, prev_close')
      .eq('instrument_id', inst.id)
      .maybeSingle(),
    fetchAll((from, to) =>
      supabase
        .from('orders')
        .select('id, side, quantity, unit_price, fees, executed_at')
        .eq('instrument_id', instrumentId)
        .order('id')
        .range(from, to),
    ),
  ]);
  let alreadyTrue = false;
  if (quote.data) {
    let avgCost: number | null;
    try {
      const pos = computePosition(
        orders.map((o) => ({
          id: o.id,
          side: o.side,
          quantity: o.quantity,
          unitPrice: o.unit_price,
          fees: o.fees,
          executedAt: o.executed_at,
        })),
      );
      avgCost = pos.quantity > 0 ? pos.avgCost : null;
    } catch {
      avgCost = null;
    }
    alreadyTrue = evaluateAlert(
      { type: data.type, threshold: data.threshold },
      { price: quote.data.price, prevClose: quote.data.prev_close, avgCost },
    ).triggered;
  }

  revalidatePath('/alerts');
  redirect(alreadyTrue ? '/alerts?notice=already_true' : '/alerts');
}

export async function setAlertStatus(id: string, status: 'active' | 'paused') {
  const supabase = await createClient();
  await supabase.from('alerts').update({ status }).eq('id', id);
  revalidatePath('/alerts');
}

export async function deleteAlert(id: string) {
  const supabase = await createClient();
  await supabase.from('alerts').delete().eq('id', id);
  revalidatePath('/alerts');
}

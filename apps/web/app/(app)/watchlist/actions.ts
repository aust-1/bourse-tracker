'use server';

import { revalidatePath } from 'next/cache';
import { ensureInstrument } from '@/lib/instruments';
import { createClient } from '@/lib/supabase/server';

export interface WatchFormState {
  error?: string;
  added?: number;
}

/** Ajoute un titre (symbole Yahoo) à la liste de suivi : vérifié comme pour un ordre. */
export async function addToWatchlist(
  _prev: WatchFormState,
  formData: FormData,
): Promise<WatchFormState> {
  const symbol = String(formData.get('symbol') ?? '').trim();
  if (!symbol) return { error: 'Choisis un instrument' };
  const supabase = await createClient();
  const inst = await ensureInstrument(supabase, symbol);
  if (!inst.id) return { error: inst.error };
  const { error } = await supabase.rpc('set_instrument_watched', {
    p_instrument: inst.id,
    p_watched: true,
  });
  if (error) return { error: `Erreur : ${error.message}` };
  revalidatePath('/watchlist');
  return { added: Date.now() };
}

/** Ajoute ou retire un titre déjà suivi (bouton de la liste ou de la fiche du titre). */
export async function setWatched(instrumentId: string, watched: boolean) {
  const supabase = await createClient();
  await supabase.rpc('set_instrument_watched', { p_instrument: instrumentId, p_watched: watched });
  revalidatePath('/watchlist');
  revalidatePath(`/instruments/${instrumentId}`);
}

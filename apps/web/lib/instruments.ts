import type { Database } from '@bourse/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dbErrorMessage } from './orders';
import { yahoo } from './yahoo';

/**
 * Ajoute l'instrument (symbole Yahoo) aux titres suivis par l'utilisateur et renvoie son id.
 * Un instrument encore inconnu de la base est d'abord vérifié auprès de la source de prix :
 * il doit exister et être coté en EUR.
 */
export async function ensureInstrument(
  supabase: SupabaseClient<Database>,
  symbol: string,
): Promise<{ id?: string; error?: string }> {
  const known = await supabase.rpc('track_instrument', { p_symbol: symbol });
  if (known.error) return { error: dbErrorMessage(known.error) };
  if (known.data) return { id: known.data };

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
  const created = await supabase.rpc('track_instrument', {
    p_symbol: symbol,
    p_name: quote.name ?? symbol,
    p_exchange: quote.exchange ?? undefined,
  });
  if (created.error || !created.data) {
    return { error: created.error ? dbErrorMessage(created.error) : 'Instrument non enregistré.' };
  }
  return { id: created.data };
}

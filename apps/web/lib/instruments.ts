import type { Database } from '@bourse/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dbErrorMessage } from './orders';
import { yahoo } from './yahoo';

/**
 * Retrouve l'instrument par son symbole Yahoo, ou le crée après avoir vérifié
 * qu'il existe et qu'il est coté en EUR.
 */
export async function ensureInstrument(
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

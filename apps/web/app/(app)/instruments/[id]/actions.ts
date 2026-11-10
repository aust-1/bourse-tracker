'use server';

import { normalizeIsin } from '@bourse/core';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { yahoo } from '@/lib/yahoo';

/** Saisie d'un split (administrateur : la RLS refuse les autres comptes). */
export async function addSplit(instrumentId: string, formData: FormData) {
  const effectiveOn = String(formData.get('effectiveOn') ?? '');
  const from = Number(formData.get('from'));
  const to = Number(formData.get('to'));
  const path = `/instruments/${instrumentId}`;
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(effectiveOn) &&
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from > 0 &&
    to > 0 &&
    from !== to;
  if (!valid) redirect(`${path}?error=${encodeURIComponent('Division invalide')}`);

  const supabase = await createClient();
  const { error } = await supabase.from('splits').insert({
    instrument_id: instrumentId,
    effective_on: effectiveOn,
    ratio_from: from,
    ratio_to: to,
  });
  if (error) {
    const message =
      error.code === '23505'
        ? 'Une division existe déjà à cette date'
        : `Erreur : ${error.message}`;
    redirect(`${path}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath('/', 'layout');
}

export async function deleteSplit(instrumentId: string, splitId: string) {
  const supabase = await createClient();
  await supabase.from('splits').delete().eq('id', splitId);
  revalidatePath('/', 'layout');
  redirect(`/instruments/${instrumentId}`);
}

/** ISIN du titre : renseigné une fois par qui le suit, corrigé ensuite par l'administrateur. */
export async function saveIsin(instrumentId: string, formData: FormData) {
  const path = `/instruments/${instrumentId}`;
  const isin = normalizeIsin(String(formData.get('isin') ?? ''));
  if (!isin)
    redirect(`${path}?error=${encodeURIComponent('ISIN invalide (12 caractères, clé fausse ?)')}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_instrument_isin', {
    p_instrument: instrumentId,
    p_isin: isin,
  });
  if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/', 'layout');
  redirect(path);
}

/**
 * Nouveau symbole Yahoo (administrateur). Le symbole est d'abord vérifié auprès de Yahoo :
 * il doit exister et coter en euros. Même ISIN déjà suivi sous ce symbole : fusion.
 */
export async function changeSymbol(instrumentId: string, formData: FormData) {
  const path = `/instruments/${instrumentId}`;
  const symbol = String(formData.get('symbol') ?? '')
    .trim()
    .toUpperCase();
  if (!/^[\^A-Z0-9.=-]{1,20}$/.test(symbol)) {
    redirect(`${path}?error=${encodeURIComponent('Symbole invalide')}`);
  }
  let name: string | null = null;
  let problem: string | null = null;
  try {
    const quote = await yahoo.getQuote(symbol);
    if (quote.currency !== 'EUR') problem = `${symbol} cote en ${quote.currency}, pas en EUR`;
    name = quote.name;
  } catch {
    problem = `${symbol} est inconnu de Yahoo`;
  }
  if (problem) redirect(`${path}?error=${encodeURIComponent(problem)}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_change_symbol', {
    p_instrument: instrumentId,
    p_symbol: symbol,
    p_name: name ?? undefined,
  });
  if (error) redirect(`${path}?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/', 'layout');
  redirect(`${path}?notice=symbol`);
}

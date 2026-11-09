'use server';

import { revalidatePath } from 'next/cache';
import { dbErrorMessage } from '@/lib/orders';
import { createClient } from '@/lib/supabase/server';

export interface InvitationState {
  error?: string;
}

/** Réservé aux administrateurs : la RLS refuse l'insertion aux autres comptes. */
export async function createInvitation(
  _prev: InvitationState,
  formData: FormData,
): Promise<InvitationState> {
  const note = String(formData.get('note') ?? '').trim() || null;
  if (note && note.length > 100) return { error: 'Note trop longue (100 caractères maximum).' };

  const supabase = await createClient();
  const { error } = await supabase.from('invitations').insert({ note });
  if (error) return { error: dbErrorMessage(error) };
  revalidatePath('/invitations');
  return {};
}

export async function revokeInvitation(id: string) {
  const supabase = await createClient();
  await supabase.from('invitations').delete().eq('id', id);
  revalidatePath('/invitations');
}

/** Désactive (connexion refusée, sessions fermées, plus d'alertes) ou réactive un compte. */
export async function setAccountDisabled(userId: string, disabled: boolean) {
  const supabase = await createClient();
  await supabase.rpc('admin_set_disabled', { p_user: userId, p_disabled: disabled });
  revalidatePath('/invitations');
}

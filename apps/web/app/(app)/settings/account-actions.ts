'use server';

import { redirect } from 'next/navigation';
import { DELETE_CONFIRMATION } from '@/lib/account';
import { createClient } from '@/lib/supabase/server';

export interface DeleteState {
  error?: string;
}

/** Supprime le compte connecté et toutes ses données (fonction SQL `delete_my_account`). */
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  if (String(formData.get('confirm') ?? '').trim() !== DELETE_CONFIRMATION) {
    return { error: `Tape ${DELETE_CONFIRMATION} pour confirmer.` };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    if (error.code === '23514') return { error: error.message };
    return { error: 'Suppression impossible pour le moment.' };
  }
  // la session ne correspond plus à aucun compte : on efface les cookies localement
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/login?deleted=1');
}

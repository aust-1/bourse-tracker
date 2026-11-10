'use server';

import { MIN_PASSWORD } from '@/lib/signup';
import { createClient } from '@/lib/supabase/server';

export interface PasswordState {
  error?: string;
  done?: boolean;
}

/** Nouveau mot de passe (après un lien de réinitialisation, ou depuis les réglages). */
export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < MIN_PASSWORD) {
    return { error: `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.` };
  }
  if (password !== confirm) return { error: 'Les deux saisies ne correspondent pas.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === 'same_password') {
      return { error: 'Le nouveau mot de passe doit être différent de l’actuel.' };
    }
    if (error.code === 'weak_password') return { error: 'Mot de passe trop faible.' };
    if (error.code === 'insufficient_aal') {
      return { error: 'Valide d’abord ton code de double authentification.' };
    }
    return { error: 'Le mot de passe n’a pas pu être changé.' };
  }
  return { done: true };
}

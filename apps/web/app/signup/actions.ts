'use server';

import { redirect } from 'next/navigation';
import { MIN_PASSWORD } from '@/lib/signup';
import { createClient } from '@/lib/supabase/server';

export interface SignUpState {
  error?: string;
  message?: string;
  email?: string;
}

const INVALID = 'Ce lien d’invitation est invalide, expiré ou déjà utilisé.';

/** Crée le compte ; la base refuse l'inscription si le code d'invitation n'est plus valable. */
export async function signUp(
  code: string,
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email et mot de passe requis.', email };
  if (password.length < MIN_PASSWORD) {
    return { error: `Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`, email };
  }

  const supabase = await createClient();
  const valid = await supabase.rpc('invitation_is_valid', { p_code: code });
  if (!valid.data) return { error: INVALID, email };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { invite_code: code } },
  });
  if (error) {
    if (error.code === 'user_already_exists' || error.code === 'email_exists') {
      return { error: 'Un compte existe déjà avec cet email.', email };
    }
    if (error.code === 'weak_password') return { error: 'Mot de passe trop faible.', email };
    // le trigger de la base a refusé l'invitation (utilisée entre-temps, par exemple)
    return { error: INVALID, email };
  }
  if (!data.session) {
    return { message: 'Compte créé : confirme ton adresse avec l’email reçu, puis connecte-toi.' };
  }
  redirect('/');
}

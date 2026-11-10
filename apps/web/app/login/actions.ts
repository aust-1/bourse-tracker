'use server';

import { redirect } from 'next/navigation';
import { needsSecondFactor } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export interface FormState {
  error?: string;
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email et mot de passe requis.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === 'user_banned') return { error: 'Ce compte a été désactivé.' };
    return { error: 'Identifiants incorrects.' };
  }
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  redirect(needsSecondFactor(aal) ? '/mfa' : '/');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

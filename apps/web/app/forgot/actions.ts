'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export interface ForgotState {
  error?: string;
  sent?: boolean;
}

/**
 * Envoie un lien de réinitialisation. La réponse est la même que le compte existe ou non :
 * la page ne doit pas servir à deviner quelles adresses sont inscrites.
 */
export async function requestReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Email requis.' };

  const h = await headers();
  const origin = h.get('origin') ?? `https://${h.get('host')}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/settings/password`,
  });
  // limite d'envoi atteinte : seul cas signalé, il ne révèle rien sur l'adresse
  if (error?.status === 429) return { error: 'Trop de demandes : réessaie dans quelques minutes.' };
  return { sent: true };
}

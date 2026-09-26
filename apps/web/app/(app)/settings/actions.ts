'use server';

import { Notifier } from '@bourse/providers';
import { revalidatePath } from 'next/cache';
import { dbErrorMessage } from '@/lib/orders';
import { describeDelivery, parseSettingsForm } from '@/lib/settings';
import { snapshot, type FormValues } from '@/lib/form-state';
import { createClient } from '@/lib/supabase/server';

export interface SettingsState {
  error?: string;
  /** Valeurs soumises, réutilisées comme valeurs par défaut (cf. lib/form-state.ts) */
  values?: FormValues;
  message?: string;
}

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { data, error } = parseSettingsForm(formData);
  if (!data) return { error, values: snapshot(formData) };

  const supabase = await createClient();
  const { error: dbError } = await supabase.from('settings').upsert(
    {
      discord_webhook_url: data.discordWebhookUrl,
      email: data.email,
      summary_enabled: data.summaryEnabled,
      summary_time: data.summaryTime,
    },
    { onConflict: 'user_id' },
  );
  if (dbError) return { error: dbErrorMessage(dbError), values: snapshot(formData) };

  revalidatePath('/settings');
  return { message: 'Réglages enregistrés.', values: snapshot(formData) };
}

/** Envoie un message de test avec les réglages ENREGISTRÉS de l'utilisateur. */
export async function sendTest(channel: 'discord' | 'email'): Promise<{ message: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('discord_webhook_url, email')
    .maybeSingle();

  const notifier = new Notifier({
    resendApiKey: process.env.RESEND_API_KEY || null,
    emailFrom: process.env.EMAIL_FROM || 'Bourse Tracker <onboarding@resend.dev>',
  });
  const delivery = await notifier.notify(
    data ? { discordWebhookUrl: data.discord_webhook_url, email: data.email } : null,
    [channel],
    {
      title: '✅ Test Bourse Tracker',
      body: 'Si tu lis ce message, les notifications fonctionnent.',
      level: 'success',
    },
  );
  return { message: describeDelivery(channel, delivery[channel]) };
}

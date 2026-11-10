'use server';

import { snapshot, type FormValues } from '@/lib/form-state';
import { dbErrorMessage } from '@/lib/orders';
import { describeDelivery, parseSettingsForm } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';
import { Notifier, ntfyHosts, type Channel } from '@bourse/providers';
import { revalidatePath } from 'next/cache';

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
      social_tax_rate: data.socialTaxRate,
      income_tax_rate: data.incomeTaxRate,
      benchmark_symbol: data.benchmarkSymbol,
      report_frequency: data.reportFrequency,
      ntfy_url: data.ntfyUrl,
      telegram_chat_id: data.telegramChatId,
    },
    { onConflict: 'user_id' },
  );
  if (dbError) return { error: dbErrorMessage(dbError), values: snapshot(formData) };

  revalidatePath('/settings');
  return { message: 'Réglages enregistrés.', values: snapshot(formData) };
}

/** Envoie un message de test avec les réglages ENREGISTRÉS de l'utilisateur. */
export async function sendTest(channel: Channel): Promise<{ message: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('discord_webhook_url, email, ntfy_url, telegram_chat_id')
    .maybeSingle();

  const notifier = new Notifier({
    resendApiKey: process.env.RESEND_API_KEY || null,
    emailFrom: process.env.EMAIL_FROM || 'Bourse Tracker <onboarding@eliott-roussille.fr>',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || null,
    ntfyHosts: ntfyHosts(process.env.NTFY_HOSTS),
  });
  const delivery = await notifier.notify(
    data
      ? {
          discordWebhookUrl: data.discord_webhook_url,
          email: data.email,
          ntfyUrl: data.ntfy_url,
          telegramChatId: data.telegram_chat_id,
        }
      : null,
    [channel],
    {
      title: '✅ Test Bourse Tracker',
      body: 'Si tu lis ce message, les notifications fonctionnent.',
      level: 'success',
    },
  );
  return { message: describeDelivery(channel, delivery[channel]) };
}

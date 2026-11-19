'use server';

import { snapshot, type FormValues } from '@/lib/form-state';
import { dbErrorMessage } from '@/lib/orders';
import {
  CHANNEL_NAMES,
  describeDelivery,
  EMAIL_NOT_VERIFIED,
  parseSettingsForm,
  TEST_TOO_SOON,
} from '@/lib/settings';
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

/**
 * Envoie un message de test avec les réglages ENREGISTRÉS de l'utilisateur : un par canal et par
 * minute au plus (limite tenue par la base), et un email seulement vers une adresse confirmée.
 */
export async function sendTest(channel: Channel): Promise<{ message: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('settings')
    .select('discord_webhook_url, email, email_verified, ntfy_url, telegram_chat_id')
    .maybeSingle();

  const resendApiKey = process.env.RESEND_API_KEY || null;
  if (channel === 'email' && resendApiKey && data?.email && !data.email_verified) {
    return { message: `${CHANNEL_NAMES.email} : ${EMAIL_NOT_VERIFIED}` };
  }
  const claim = await supabase.rpc('claim_notification_test', { p_channel: channel });
  if (claim.error) return { message: dbErrorMessage(claim.error) };
  if (!claim.data) return { message: `${CHANNEL_NAMES[channel] ?? channel} : ${TEST_TOO_SOON}` };

  const notifier = new Notifier({
    resendApiKey,
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

export interface EmailCodeState {
  error?: string;
  message?: string;
  /** Code demandé : le champ de saisie s'affiche */
  requested?: boolean;
  verified?: boolean;
}

/** Demande d'un code de confirmation pour l'adresse enregistrée (envoyé par le worker). */
export async function requestEmailCode(): Promise<EmailCodeState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_notification_email_code');
  // messages de la base, en français (délai entre deux demandes, rien à confirmer)
  if (error) return { error: error.message };
  revalidatePath('/settings');
  return {
    requested: true,
    message: 'Code demandé : il arrive par email dans une minute environ (valable 30 minutes).',
  };
}

export async function confirmEmailCode(
  _prev: EmailCodeState,
  formData: FormData,
): Promise<EmailCodeState> {
  const code = String(formData.get('code') ?? '').trim();
  if (!/^\d{6}$/.test(code)) return { requested: true, error: 'Code à 6 chiffres' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('confirm_notification_email', { p_code: code });
  if (error) return { requested: true, error: error.message };
  if (!data) return { requested: true, error: 'Code incorrect' };
  revalidatePath('/settings');
  return { verified: true, message: 'Adresse confirmée ✔' };
}

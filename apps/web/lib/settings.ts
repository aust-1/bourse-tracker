import { isDiscordWebhook } from '@bourse/providers';
import { z } from 'zod';

/** Le résumé part à partir de l'heure choisie ; le worker travaille jusqu'à 23 h. */
export const SUMMARY_MIN = '17:45';
export const SUMMARY_MAX = '22:30';

const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim());

export const settingsSchema = z.object({
  discordWebhookUrl: z
    .string()
    .transform(blankToNull)
    .refine(
      (v) => v === null || isDiscordWebhook(v),
      'Webhook Discord invalide (https://discord.com/api/webhooks/…)',
    ),
  email: z
    .string()
    .transform(blankToNull)
    .refine((v) => v === null || z.email().safeParse(v).success, 'Adresse email invalide'),
  summaryEnabled: z.boolean(),
  summaryTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Heure invalide')
    .refine(
      (t) => t >= SUMMARY_MIN && t <= SUMMARY_MAX,
      `L'heure du résumé doit être entre ${SUMMARY_MIN} et ${SUMMARY_MAX}`,
    ),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export function parseSettingsForm(formData: FormData): { data?: SettingsInput; error?: string } {
  const parsed = settingsSchema.safeParse({
    discordWebhookUrl: String(formData.get('discordWebhookUrl') ?? ''),
    email: String(formData.get('email') ?? ''),
    summaryEnabled: formData.get('summaryEnabled') === 'on',
    summaryTime: String(formData.get('summaryTime') ?? ''),
  });
  if (parsed.success) return { data: parsed.data };
  return { error: parsed.error.issues[0]?.message ?? 'Saisie invalide' };
}

/** Message lisible pour le statut d'envoi d'un canal (bouton « envoyer un test »). */
export function describeDelivery(channel: string, status: string | undefined): string {
  const name = channel === 'discord' ? 'Discord' : 'Email';
  if (status === 'sent') return `${name} : message de test envoyé ✔`;
  if (status === 'not_configured')
    return `${name} : non configuré (enregistre d'abord tes réglages)`;
  return `${name} : échec (${(status ?? 'inconnu').replace(/^error: /, '')})`;
}

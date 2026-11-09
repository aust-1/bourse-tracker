import { isDiscordWebhook, isNtfyUrl, isTelegramChatId, ntfyHosts } from '@bourse/providers';
import { z } from 'zod';

/** Le résumé part à partir de l'heure choisie ; le worker travaille jusqu'à 23 h. */
export const SUMMARY_MIN = '17:45';
export const SUMMARY_MAX = '22:30';

const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim());

/** Taux par défaut (2026) ; réglables, ils changent avec les lois de finances. */
export const DEFAULT_SOCIAL_RATE = 17.2;
export const DEFAULT_INCOME_RATE = 12.8;

/** Pourcentage entre 0 et 100, virgule acceptée ; vide = valeur par défaut. */
const rate = (label: string, fallback: number) =>
  z
    .string()
    .transform((s) => s.trim().replace(',', '.'))
    .transform((s, ctx) => {
      if (s === '') return fallback;
      const n = Number(s);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        ctx.addIssue({ code: 'custom', message: `${label} : pourcentage entre 0 et 100` });
        return z.NEVER;
      }
      return n;
    });

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
  socialTaxRate: rate('Prélèvements sociaux', DEFAULT_SOCIAL_RATE),
  incomeTaxRate: rate('Impôt sur le revenu', DEFAULT_INCOME_RATE),
  benchmarkSymbol: z
    .string()
    .transform(blankToNull)
    .refine(
      (v) => v === null || /^[\^A-Za-z0-9.=-]{1,20}$/.test(v),
      'Indice de référence : symbole Yahoo invalide (ex. ^FCHI, CW8.PA)',
    ),
  ntfyUrl: z
    .string()
    .transform(blankToNull)
    .refine(
      // serveurs autorisés : ntfy.sh et ceux de NTFY_HOSTS (validation côté serveur)
      (v) => v === null || isNtfyUrl(v, ntfyHosts(process.env.NTFY_HOSTS)),
      'Sujet ntfy invalide ou serveur non autorisé (https://ntfy.sh/mon-sujet)',
    ),
  telegramChatId: z
    .string()
    .transform(blankToNull)
    .refine((v) => v === null || isTelegramChatId(v), 'Identifiant Telegram invalide (chiffres)'),
  reportFrequency: z
    .enum(['', 'weekly', 'monthly'], { error: 'Fréquence de rapport invalide' })
    .transform((v) => (v === '' ? null : v)),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export function parseSettingsForm(formData: FormData): { data?: SettingsInput; error?: string } {
  const parsed = settingsSchema.safeParse({
    discordWebhookUrl: String(formData.get('discordWebhookUrl') ?? ''),
    email: String(formData.get('email') ?? ''),
    summaryEnabled: formData.get('summaryEnabled') === 'on',
    summaryTime: String(formData.get('summaryTime') ?? ''),
    socialTaxRate: String(formData.get('socialTaxRate') ?? ''),
    incomeTaxRate: String(formData.get('incomeTaxRate') ?? ''),
    benchmarkSymbol: String(formData.get('benchmarkSymbol') ?? ''),
    reportFrequency: String(formData.get('reportFrequency') ?? ''),
    ntfyUrl: String(formData.get('ntfyUrl') ?? ''),
    telegramChatId: String(formData.get('telegramChatId') ?? ''),
  });
  if (parsed.success) return { data: parsed.data };
  return { error: parsed.error.issues[0]?.message ?? 'Saisie invalide' };
}

export const CHANNEL_NAMES: Record<string, string> = {
  discord: 'Discord',
  email: 'Email',
  ntfy: 'ntfy',
  telegram: 'Telegram',
};

/** Message lisible pour le statut d'envoi d'un canal (bouton « envoyer un test »). */
export function describeDelivery(channel: string, status: string | undefined): string {
  const name = CHANNEL_NAMES[channel] ?? channel;
  if (status === 'sent') return `${name} : message de test envoyé ✔`;
  if (status === 'not_configured')
    return `${name} : non configuré (enregistre d'abord tes réglages)`;
  return `${name} : échec (${(status ?? 'inconnu').replace(/^error: /, '')})`;
}

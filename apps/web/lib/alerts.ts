import { isPortfolioAlert, type AlertType } from '@bourse/core';
import { z } from 'zod';
import { num } from './zod-helpers';

export interface AlertTypeInfo {
  value: AlertType;
  label: string;
  unit: 'eur' | 'pct';
  /** Signe du seuil stocké : l'utilisateur saisit toujours une valeur positive. */
  sign: 1 | -1;
}

export const ALERT_TYPES: readonly AlertTypeInfo[] = [
  { value: 'price_above', label: 'Le cours atteint ou dépasse', unit: 'eur', sign: 1 },
  { value: 'price_below', label: 'Le cours passe sous', unit: 'eur', sign: 1 },
  { value: 'day_change_up', label: 'Hausse du jour d’au moins', unit: 'pct', sign: 1 },
  { value: 'day_change_down', label: 'Baisse du jour d’au moins', unit: 'pct', sign: -1 },
  { value: 'position_pl_above', label: 'Gain sur ma position d’au moins', unit: 'pct', sign: 1 },
  { value: 'position_pl_below', label: 'Perte sur ma position d’au moins', unit: 'pct', sign: -1 },
  {
    value: 'drawdown_from_high',
    label: 'Baisse depuis le plus haut d’au moins',
    unit: 'pct',
    sign: -1,
  },
  {
    value: 'portfolio_value_above',
    label: 'Portefeuille : valeur d’au moins',
    unit: 'eur',
    sign: 1,
  },
  {
    value: 'portfolio_value_below',
    label: 'Portefeuille : valeur sous',
    unit: 'eur',
    sign: 1,
  },
  {
    value: 'portfolio_day_change_up',
    label: 'Portefeuille : hausse du jour d’au moins',
    unit: 'pct',
    sign: 1,
  },
  {
    value: 'portfolio_day_change_down',
    label: 'Portefeuille : baisse du jour d’au moins',
    unit: 'pct',
    sign: -1,
  },
];

/** Délais de réarmement proposés (minutes ; vide : réarmement manuel). */
export const REARM_CHOICES = [
  { value: '', label: 'Non (je la réarme moi-même)' },
  { value: '15', label: 'Après 15 minutes' },
  { value: '60', label: 'Après 1 heure' },
  { value: '240', label: 'Après 4 heures' },
  { value: '1440', label: 'Après 1 jour' },
] as const;

export const alertTypeInfo = (t: AlertType) => ALERT_TYPES.find((a) => a.value === t)!;

/** Valeur saisie (positive) → seuil stocké et comparé par le worker (signé). */
export const toStoredThreshold = (type: AlertType, magnitude: number) =>
  alertTypeInfo(type).sign * magnitude;

/** Seuil stocké → valeur positive affichée dans le formulaire. */
export const toMagnitude = (type: AlertType, stored: number) => Math.abs(stored);

export const CHANNELS = ['discord', 'email', 'ntfy', 'telegram'] as const;
export type Channel = (typeof CHANNELS)[number];

export const alertSchema = z
  .object({
    symbol: z.string().trim(),
    type: z.enum(ALERT_TYPES.map((a) => a.value) as [AlertType, ...AlertType[]], {
      error: "Type d'alerte invalide",
    }),
    magnitude: num('Seuil', { positive: true }),
    channels: z.array(z.enum(CHANNELS)).min(1, 'Choisis au moins un canal de notification'),
    note: z
      .string()
      .trim()
      .max(200, 'Note trop longue (200 caractères maximum)')
      .transform((s) => (s === '' ? null : s)),
    rearm: z
      .enum(REARM_CHOICES.map((r) => r.value) as [string, ...string[]], {
        error: 'Délai de réarmement invalide',
      })
      .transform((v) => (v === '' ? null : Number(v))),
  })
  .refine((a) => isPortfolioAlert(a.type) || a.symbol !== '', {
    message: 'Choisis un instrument',
  });

export function parseAlertForm(formData: FormData) {
  const parsed = alertSchema.safeParse({
    symbol: String(formData.get('symbol') ?? ''),
    type: String(formData.get('type') ?? ''),
    magnitude: String(formData.get('magnitude') ?? ''),
    channels: formData.getAll('channels').map(String),
    note: String(formData.get('note') ?? ''),
    rearm: String(formData.get('rearm') ?? ''),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Saisie invalide' };
  const { symbol, type, magnitude, channels, note, rearm } = parsed.data;
  return {
    data: {
      // une alerte de portefeuille ne porte sur aucun titre
      symbol: isPortfolioAlert(type) ? null : symbol,
      type,
      threshold: toStoredThreshold(type, magnitude),
      channels,
      note,
      rearmMinutes: rearm,
    },
  };
}

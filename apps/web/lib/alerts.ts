import type { AlertType } from '@bourse/core';
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
];

export const alertTypeInfo = (t: AlertType) => ALERT_TYPES.find((a) => a.value === t)!;

/** Valeur saisie (positive) → seuil stocké et comparé par le worker (signé). */
export const toStoredThreshold = (type: AlertType, magnitude: number) =>
  alertTypeInfo(type).sign * magnitude;

/** Seuil stocké → valeur positive affichée dans le formulaire. */
export const toMagnitude = (type: AlertType, stored: number) => Math.abs(stored);

export const CHANNELS = ['discord', 'email'] as const;
export type Channel = (typeof CHANNELS)[number];

export const alertSchema = z.object({
  symbol: z.string().trim().min(1, 'Choisis un instrument'),
  type: z.enum(ALERT_TYPES.map((a) => a.value) as [AlertType, ...AlertType[]], {
    error: "Type d'alerte invalide",
  }),
  magnitude: num('Seuil', { positive: true }),
  channels: z.array(z.enum(CHANNELS)).min(1, 'Choisis au moins un canal de notification'),
});

export function parseAlertForm(formData: FormData) {
  const parsed = alertSchema.safeParse({
    symbol: String(formData.get('symbol') ?? ''),
    type: String(formData.get('type') ?? ''),
    magnitude: String(formData.get('magnitude') ?? ''),
    channels: formData.getAll('channels').map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Saisie invalide' };
  const { symbol, type, magnitude, channels } = parsed.data;
  return { data: { symbol, type, threshold: toStoredThreshold(type, magnitude), channels } };
}

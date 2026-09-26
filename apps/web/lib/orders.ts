import { parisLocalToDate } from '@bourse/core';
import { z } from 'zod';

/** Accepte la virgule décimale française ("12,5") et les espaces ("1 000"). */
const num = (label: string, opts: { min?: number; positive?: boolean; optional?: boolean } = {}) =>
  z
    .string()
    .transform((s) => s.replace(/\s/g, '').replace(',', '.'))
    .transform((s, ctx) => {
      if (s === '' && opts.optional) return 0;
      const n = Number(s);
      if (s === '' || !Number.isFinite(n)) {
        ctx.addIssue({ code: 'custom', message: `${label} : nombre invalide` });
        return z.NEVER;
      }
      if (opts.positive && n <= 0) {
        ctx.addIssue({ code: 'custom', message: `${label} doit être supérieur à 0` });
        return z.NEVER;
      }
      if (opts.min !== undefined && n < opts.min) {
        ctx.addIssue({ code: 'custom', message: `${label} doit être ≥ ${opts.min}` });
        return z.NEVER;
      }
      return n;
    });

export const orderSchema = z.object({
  symbol: z.string().trim().min(1, 'Choisis un instrument'),
  side: z.enum(['buy', 'sell'], { error: 'Sens invalide' }),
  quantity: num('Quantité', { positive: true }),
  unitPrice: num('Prix unitaire', { min: 0 }),
  fees: num('Frais', { min: 0, optional: true }),
  executedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Date et heure invalides')
    .transform((s) => parisLocalToDate(s))
    .refine(
      (d) => d.getTime() <= Date.now() + 5 * 60_000,
      'La date ne peut pas être dans le futur',
    ),
  note: z
    .string()
    .trim()
    .transform((s) => (s === '' ? null : s)),
});

export type OrderInput = z.infer<typeof orderSchema>;

export function parseOrderForm(formData: FormData): { data?: OrderInput; error?: string } {
  const raw = Object.fromEntries(
    ['symbol', 'side', 'quantity', 'unitPrice', 'fees', 'executedAt', 'note'].map((k) => [
      k,
      String(formData.get(k) ?? ''),
    ]),
  );
  const parsed = orderSchema.safeParse(raw);
  if (parsed.success) return { data: parsed.data };
  return { error: parsed.error.issues[0]?.message ?? 'Saisie invalide' };
}

/** Traduit une erreur Postgres en message utilisateur. */
export function dbErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '23514' && /découvert/i.test(error.message)) {
    return 'Vente impossible : la quantité détenue à cette date serait négative.';
  }
  return `Erreur : ${error.message}`;
}

export interface CsvOrder {
  executed_at: string;
  symbol: string;
  name: string;
  side: 'buy' | 'sell';
  quantity: number;
  unit_price: number;
  fees: number;
  note: string | null;
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? '' : String(v);
  // neutralise l'injection de formules dans les tableurs
  const safe = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function ordersToCsv(rows: readonly CsvOrder[]): string {
  const header = ['date', 'symbole', 'nom', 'sens', 'quantite', 'prix_unitaire', 'frais', 'note'];
  const lines = rows.map((r) =>
    [
      r.executed_at,
      r.symbol,
      r.name,
      r.side === 'buy' ? 'achat' : 'vente',
      r.quantity,
      r.unit_price,
      r.fees,
      r.note,
    ]
      .map(csvCell)
      .join(';'),
  );
  return '﻿' + [header.join(';'), ...lines].join('\r\n') + '\r\n';
}

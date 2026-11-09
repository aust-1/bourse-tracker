import type { CashKind, CashMovement } from '@bourse/core';
import { fetchAll, type Database } from '@bourse/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { num } from './zod-helpers';

type Client = SupabaseClient<Database>;

export const CASH_LABELS: Record<CashKind, string> = {
  deposit: 'Versement',
  withdrawal: 'Retrait',
  dividend: 'Dividende',
  fee: 'Frais',
};

export interface CashRow extends CashMovement {
  portfolioId: string;
  note: string | null;
}

/** Mouvements du compte, limités à un portefeuille si `portfolioId` est donné. */
export async function loadCash(
  supabase: Client,
  portfolioId: string | null = null,
): Promise<CashRow[]> {
  const rows = await fetchAll((from, to) => {
    let q = supabase
      .from('cash_movements')
      .select('id, portfolio_id, kind, amount, instrument_id, occurred_on, note');
    if (portfolioId) q = q.eq('portfolio_id', portfolioId);
    return q.order('occurred_on').order('id').range(from, to);
  });
  return rows.map((r) => ({
    id: r.id,
    portfolioId: r.portfolio_id,
    kind: r.kind,
    amount: Number(r.amount),
    instrumentId: r.instrument_id,
    occurredOn: r.occurred_on,
    note: r.note,
  }));
}

export const cashSchema = z
  .object({
    portfolioId: z.string().regex(/^[0-9a-f-]{36}$/i, 'Choisis un portefeuille'),
    kind: z.enum(['deposit', 'withdrawal', 'dividend', 'fee'], { error: 'Type invalide' }),
    amount: num('Montant', { positive: true }),
    instrumentId: z
      .string()
      .trim()
      .transform((s) => (s === '' ? null : s)),
    occurredOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
      .refine(
        (s) => s <= new Date().toISOString().slice(0, 10),
        'La date ne peut pas être dans le futur',
      ),
    note: z
      .string()
      .trim()
      .max(200, 'Note trop longue (200 caractères maximum)')
      .transform((s) => (s === '' ? null : s)),
  })
  .refine((m) => m.kind !== 'dividend' || m.instrumentId !== null, {
    message: 'Choisis le titre qui a versé le dividende',
  })
  .transform((m) => ({ ...m, instrumentId: m.kind === 'dividend' ? m.instrumentId : null }));

export type CashInput = z.infer<typeof cashSchema>;

export function parseCashForm(formData: FormData): { data?: CashInput; error?: string } {
  const raw = Object.fromEntries(
    ['portfolioId', 'kind', 'amount', 'instrumentId', 'occurredOn', 'note'].map((k) => [
      k,
      String(formData.get(k) ?? ''),
    ]),
  );
  const parsed = cashSchema.safeParse(raw);
  if (parsed.success) return { data: parsed.data };
  return { error: parsed.error.issues[0]?.message ?? 'Saisie invalide' };
}

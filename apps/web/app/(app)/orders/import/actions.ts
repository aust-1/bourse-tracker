'use server';

import { fetchAll } from '@bourse/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { orderKey, parseImport } from '@/lib/import';
import { ensureInstrument } from '@/lib/instruments';
import { dbErrorMessage } from '@/lib/orders';
import { createClient } from '@/lib/supabase/server';

const MAX_BYTES = 1_000_000;

export interface PreviewLine {
  line: number;
  status: 'ok' | 'new_instrument' | 'duplicate' | 'error';
  message?: string;
  date?: string;
  label?: string;
  side?: 'buy' | 'sell';
  quantity?: number;
  unitPrice?: number;
  fees?: number;
  portfolio?: string;
}

export interface ImportState {
  error?: string;
  lines?: PreviewLine[];
  /** Ordres à importer, renvoyés tels quels à l'étape de confirmation (revalidés) */
  payload?: string;
  count?: number;
}

const payloadSchema = z.array(
  z.object({
    instrumentId: z.string().uuid().nullable(),
    symbol: z.string().min(1).max(20).nullable(),
    portfolioId: z.string().uuid(),
    side: z.enum(['buy', 'sell']),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    fees: z.number().min(0),
    executedAt: z.string().datetime(),
    note: z.string().max(500).nullable(),
  }),
);
type Payload = z.infer<typeof payloadSchema>;

async function readText(formData: FormData): Promise<string | { error: string }> {
  const file = formData.get('file');
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { error: 'Fichier trop gros (1 Mo au plus).' };
    return file.text();
  }
  const pasted = String(formData.get('csv') ?? '');
  if (pasted.length > MAX_BYTES) return { error: 'Texte trop long (1 Mo au plus).' };
  return pasted;
}

/** Étape 1 : lecture, rattachement des titres et portefeuilles, doublons. Rien n'est écrit. */
export async function previewImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const text = await readText(formData);
  if (typeof text !== 'string') return text;
  const parsed = parseImport(text);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const defaultPortfolio = String(formData.get('portfolioId') ?? '');
  const [{ data: instruments }, { data: portfolios }, existing] = await Promise.all([
    supabase.from('instruments').select('id, yahoo_symbol, isin, name'),
    supabase.from('portfolios').select('id, name'),
    fetchAll((from, to) =>
      supabase
        .from('orders')
        .select('instrument_id, side, quantity, unit_price, executed_at')
        .order('id')
        .range(from, to),
    ),
  ]);
  const bySymbol = new Map((instruments ?? []).map((i) => [i.yahoo_symbol, i]));
  const byIsin = new Map((instruments ?? []).filter((i) => i.isin).map((i) => [i.isin!, i]));
  const byName = new Map((portfolios ?? []).map((p) => [p.name.toLowerCase(), p]));
  const keys = new Set(
    existing.map((o) =>
      orderKey({
        instrumentId: o.instrument_id,
        side: o.side,
        quantity: o.quantity,
        unitPrice: o.unit_price,
        executedAt: o.executed_at,
      }),
    ),
  );

  const lines: PreviewLine[] = [];
  const payload: Payload = [];
  for (const p of parsed.lines) {
    if (!p.ok) {
      lines.push({ line: p.line, status: 'error', message: p.error });
      continue;
    }
    const r = p.row;
    const inst = (r.symbol && bySymbol.get(r.symbol)) || (r.isin && byIsin.get(r.isin)) || null;
    const portfolio = r.portfolio
      ? byName.get(r.portfolio.toLowerCase())
      : (portfolios ?? []).find((x) => x.id === defaultPortfolio);
    const base = {
      line: r.line,
      date: r.executedAt,
      label: inst ? `${inst.name} (${inst.yahoo_symbol})` : (r.symbol ?? r.isin ?? ''),
      side: r.side,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      fees: r.fees,
      portfolio: portfolio?.name ?? r.portfolio ?? undefined,
    };
    if (!portfolio) {
      lines.push({
        ...base,
        status: 'error',
        message: `portefeuille inconnu « ${r.portfolio ?? ''} »`,
      });
      continue;
    }
    if (!inst && !r.symbol) {
      lines.push({
        ...base,
        status: 'error',
        message: 'ISIN inconnu : ajoute d’abord le titre, ou une colonne symbole (Yahoo)',
      });
      continue;
    }
    if (
      inst &&
      keys.has(
        orderKey({
          instrumentId: inst.id,
          side: r.side,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          executedAt: r.executedAt,
        }),
      )
    ) {
      lines.push({ ...base, status: 'duplicate', message: 'déjà présent, ignoré' });
      continue;
    }
    lines.push({
      ...base,
      status: inst ? 'ok' : 'new_instrument',
      message: inst ? undefined : 'nouveau titre, vérifié auprès de Yahoo à l’import',
    });
    payload.push({
      instrumentId: inst?.id ?? null,
      symbol: inst ? null : r.symbol,
      portfolioId: portfolio.id,
      side: r.side,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      fees: r.fees,
      executedAt: r.executedAt,
      note: r.note,
    });
  }
  return { lines, payload: JSON.stringify(payload), count: payload.length };
}

/** Étape 2 : ajout de tous les ordres en une fois (la base refuse l'ensemble en cas de découvert). */
export async function confirmImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  let rows: Payload;
  try {
    rows = payloadSchema.parse(JSON.parse(String(formData.get('payload') ?? '[]')));
  } catch {
    return { error: 'Import invalide : recommence l’aperçu.' };
  }
  if (rows.length === 0) return { error: 'Aucun ordre à importer.' };

  const supabase = await createClient();
  const resolved = new Map<string, string>();
  for (const symbol of new Set(rows.filter((r) => !r.instrumentId).map((r) => r.symbol!))) {
    const inst = await ensureInstrument(supabase, symbol);
    if (!inst.id) return { error: `${symbol} : ${inst.error ?? 'titre introuvable'}` };
    resolved.set(symbol, inst.id);
  }

  const { error } = await supabase.from('orders').insert(
    rows.map((r) => ({
      instrument_id: r.instrumentId ?? resolved.get(r.symbol!)!,
      portfolio_id: r.portfolioId,
      side: r.side,
      quantity: r.quantity,
      unit_price: r.unitPrice,
      fees: r.fees,
      executed_at: r.executedAt,
      note: r.note,
    })),
  );
  if (error) return { error: `Rien n'a été importé. ${dbErrorMessage(error)}` };

  revalidatePath('/', 'layout');
  redirect(`/orders?imported=${rows.length}`);
}

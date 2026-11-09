import { normalizeIsin, parisLocalToDate } from '@bourse/core';

/** Découpe un CSV (séparateur détecté : « ; », « , » ou tabulation ; guillemets gérés). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const counts = [';', '\t', ','].map((d) => [d, firstLine.split(d).length - 1] as const);
  const delimiter = counts.reduce((best, c) => (c[1] > best[1] ? c : best))[0];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** En-têtes reconnus (export de l'application et libellés courants des courtiers). */
const ALIASES = {
  date: ['date', 'date operation', 'date d execution', 'date execution', 'date heure', 'execution'],
  symbol: ['symbole', 'symbol', 'ticker', 'code', 'mnemo', 'mnemonique'],
  isin: ['isin', 'code isin'],
  name: ['nom', 'libelle', 'valeur', 'titre', 'name'],
  side: ['sens', 'type', 'operation', 'type d operation', 'nature', 'side'],
  quantity: ['quantite', 'qte', 'quantity', 'nombre', 'nb titres'],
  price: ['prix unitaire', 'prix', 'cours', 'cours d execution', 'price', 'pu'],
  fees: ['frais', 'commission', 'commissions', 'courtage', 'fees'],
  note: ['note', 'commentaire', 'reference'],
  portfolio: ['portefeuille', 'compte', 'portfolio'],
} as const;

export type ImportField = keyof typeof ALIASES;
export type ColumnMap = Partial<Record<ImportField, number>>;

export function mapColumns(headers: readonly string[]): ColumnMap {
  const folded = headers.map(fold);
  const map: ColumnMap = {};
  for (const [field, aliases] of Object.entries(ALIASES) as [ImportField, readonly string[]][]) {
    const i = folded.findIndex((h) => (aliases as readonly string[]).includes(h));
    if (i >= 0 && !Object.values(map).includes(i)) map[field] = i;
  }
  return map;
}

export interface ImportRow {
  line: number;
  executedAt: string;
  symbol: string | null;
  isin: string | null;
  name: string | null;
  side: 'buy' | 'sell';
  quantity: number;
  unitPrice: number;
  fees: number;
  note: string | null;
  portfolio: string | null;
}

export type ParsedLine = { ok: true; row: ImportRow } | { ok: false; line: number; error: string };

/** Nombre à la française ou à l'anglaise : « 1 234,56 », « 1234.56 », « 12,5 € ». */
export function parseNumber(raw: string): number | null {
  let s = raw.replace(/[\s\u00a0\u202f€]/g, '');
  if (s === '') return null;
  if (s.includes(',') && s.includes('.')) {
    // le dernier séparateur est la décimale
    s =
      s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
  } else {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Date ISO (avec fuseau), « AAAA-MM-JJ[ HH:MM] » ou « JJ/MM/AAAA[ HH:MM] » (heure de Paris). */
export function parseDate(raw: string): Date | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(s);
  if (!m) {
    const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:h](\d{2})(?::\d{2})?)?$/.exec(s);
    if (fr)
      m = [
        fr[0],
        fr[3]!,
        fr[2]!.padStart(2, '0'),
        fr[1]!.padStart(2, '0'),
        fr[4]!,
        fr[5]!,
      ] as never;
  }
  if (!m) return null;
  const [, y, mo, d, h, mi] = m as unknown as [string, string, string, string, string?, string?];
  // sans heure : 12:00, au milieu de la séance (le jour compte, pas l'heure)
  const local = `${y}-${mo}-${d}T${(h ?? '12').padStart(2, '0')}:${mi ?? '00'}`;
  try {
    const date = parisLocalToDate(local);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function parseSide(raw: string): 'buy' | 'sell' | null {
  const f = fold(raw);
  if (/^(achat|buy|a|acheter|achat comptant)\b/.test(f)) return 'buy';
  if (/^(vente|sell|v|vendre|vente comptant)\b/.test(f)) return 'sell';
  return null;
}

/** Lignes d'un CSV d'ordres ; chaque ligne est valide ou porte son erreur. */
export function parseImport(text: string): {
  columns: ColumnMap;
  lines: ParsedLine[];
  error?: string;
} {
  const rows = parseCsv(text);
  if (rows.length < 2) return { columns: {}, lines: [], error: 'Fichier vide ou sans en-tête.' };
  const columns = mapColumns(rows[0]!);
  const missing = (['date', 'side', 'quantity', 'price'] as const).filter(
    (f) => columns[f] === undefined,
  );
  if (columns.symbol === undefined && columns.isin === undefined) missing.push('symbol' as never);
  if (missing.length) {
    return {
      columns,
      lines: [],
      error: `Colonnes introuvables : ${missing.join(', ')}. En-têtes attendus : date, symbole ou isin, sens, quantite, prix_unitaire (frais, note, portefeuille facultatifs).`,
    };
  }

  const cell = (r: string[], f: ImportField) =>
    columns[f] === undefined ? '' : (r[columns[f]!] ?? '').trim();
  const lines = rows.slice(1).map((r, i): ParsedLine => {
    const line = i + 2;
    const date = parseDate(cell(r, 'date'));
    if (!date) return { ok: false, line, error: `date illisible « ${cell(r, 'date')} »` };
    const side = parseSide(cell(r, 'side'));
    if (!side)
      return { ok: false, line, error: `sens inconnu « ${cell(r, 'side')} » (achat / vente)` };
    const quantity = parseNumber(cell(r, 'quantity'));
    if (quantity === null || quantity <= 0) return { ok: false, line, error: 'quantité invalide' };
    const unitPrice = parseNumber(cell(r, 'price'));
    if (unitPrice === null || unitPrice < 0) return { ok: false, line, error: 'prix invalide' };
    const fees = cell(r, 'fees') === '' ? 0 : parseNumber(cell(r, 'fees'));
    if (fees === null || fees < 0) return { ok: false, line, error: 'frais invalides' };
    const rawIsin = cell(r, 'isin');
    const isin = rawIsin ? normalizeIsin(rawIsin) : null;
    if (rawIsin && !isin) return { ok: false, line, error: `ISIN invalide « ${rawIsin} »` };
    const symbol = cell(r, 'symbol').toUpperCase() || null;
    if (!symbol && !isin) return { ok: false, line, error: 'ni symbole ni ISIN' };
    if (date.getTime() > Date.now() + 5 * 60_000)
      return { ok: false, line, error: 'date dans le futur' };
    return {
      ok: true,
      row: {
        line,
        executedAt: date.toISOString(),
        symbol,
        isin,
        name: cell(r, 'name') || null,
        side,
        quantity,
        unitPrice,
        fees: fees ?? 0,
        note: cell(r, 'note') || null,
        portfolio: cell(r, 'portfolio') || null,
      },
    };
  });
  return { columns, lines };
}

/** Clé d'un ordre pour repérer un doublon déjà en base (instrument, sens, quantité, prix, instant). */
export const orderKey = (o: {
  instrumentId: string;
  side: string;
  quantity: number;
  unitPrice: number;
  executedAt: string;
}) => [o.instrumentId, o.side, o.quantity, o.unitPrice, new Date(o.executedAt).getTime()].join('|');

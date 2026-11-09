export interface Slice {
  label: string;
  value: number;
  /** Part du total, en pourcents */
  pct: number;
}

export interface Allocation {
  byLine: Slice[];
  byType: Slice[];
  total: number;
}

const TYPE_LABELS = { etf: 'ETF', equity: 'Actions' } as const;

/**
 * Répartition par ligne et par type d'actif (une ligne sans cote compte à son prix de revient,
 * comme dans les totaux). Les liquidités positives forment une tranche à part. Tri décroissant.
 */
export function allocation(
  rows: readonly {
    name: string;
    marketValue: number | null;
    costBasis: number;
    assetType?: 'etf' | 'equity' | null;
  }[],
  cash: number | null = null,
): Allocation {
  const lines = rows.map((r) => ({
    label: r.name,
    value: r.marketValue ?? r.costBasis,
    type: r.assetType ? TYPE_LABELS[r.assetType] : 'Non classé',
  }));
  const cashValue = cash !== null && cash > 0 ? cash : 0;
  const total = lines.reduce((s, l) => s + l.value, 0) + cashValue;
  const slice = (label: string, value: number): Slice => ({
    label,
    value,
    pct: total > 0 ? (value / total) * 100 : 0,
  });
  const byDesc = (a: Slice, b: Slice) => b.value - a.value;

  const types = new Map<string, number>();
  for (const l of lines) types.set(l.type, (types.get(l.type) ?? 0) + l.value);
  if (cashValue > 0) types.set('Liquidités', cashValue);

  const byLine = lines.map((l) => slice(l.label, l.value));
  if (cashValue > 0) byLine.push(slice('Liquidités', cashValue));
  return {
    byLine: byLine.sort(byDesc),
    byType: [...types].map(([label, value]) => slice(label, value)).sort(byDesc),
    total,
  };
}

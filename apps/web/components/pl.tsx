import { eur, pct, signClass } from '@/lib/format';

/** Montant ou pourcentage signé : couleur + flèche (jamais la couleur seule). */
export function Pl({
  value,
  kind = 'eur',
  className = '',
}: {
  value: number | null;
  kind?: 'eur' | 'pct';
  className?: string;
}) {
  if (value === null) return <span className="text-slate-400">—</span>;
  const arrow = Math.abs(value) < 0.005 ? '' : value > 0 ? '▲ ' : '▼ ';
  const text = kind === 'eur' ? `${value > 0 ? '+' : ''}${eur(value)}` : pct(value);
  return (
    <span className={`whitespace-nowrap tabular-nums ${signClass(value)} ${className}`}>
      {arrow}
      {text}
    </span>
  );
}

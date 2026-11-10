import type { Slice } from '@/lib/allocation';
import { eur } from '@/lib/format';

const pctFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/**
 * Barres horizontales triées, une seule teinte : l'identité est portée par le libellé, jamais
 * par la couleur. Chaque barre affiche sa part et sa valeur (lisible sans survol ni couleur).
 */
export function AllocationBars({ title, slices }: { title: string; slices: Slice[] }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs text-slate-500">{title}</figcaption>
      <ul className="flex flex-col gap-0.5" aria-label={title}>
        {slices.map((s) => (
          <li
            key={s.label}
            className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2 text-sm"
            title={`${s.label} : ${pctFmt.format(s.pct)} % (${eur(s.value)})`}
          >
            <span className="truncate">{s.label}</span>
            <span className="h-3 w-full" aria-hidden>
              <span
                className="block h-3 rounded-r bg-phosphor"
                style={{ width: `${Math.max(s.pct, 0.5)}%` }}
              />
            </span>
            <span className="text-right tabular-nums text-slate-600 dark:text-slate-400">
              {pctFmt.format(s.pct)} %
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

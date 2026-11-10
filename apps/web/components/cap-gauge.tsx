import type { CapStatus } from '@bourse/core';
import { eur } from '@/lib/format';

/** Jauge d'un plafond de versements. */
export function CapGauge({ label, status }: { label: string; status: CapStatus }) {
  const pct = Math.min(100, status.usedPct);
  const over = status.used > status.cap;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <span>{label}</span>
        <span className="tabular-nums">
          {eur(status.used)} / {eur(status.cap)}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={status.cap}
        aria-valuenow={status.used}
        className="h-2 w-full bg-slate-200 dark:bg-slate-800"
      >
        <div
          className={`h-2 ${over ? 'bg-red-600' : 'bg-emerald-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500">
        {over ? 'Plafond dépassé' : `Reste ${eur(status.remaining)} de versements possibles`}
      </span>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { LineChart, type ChartPoint } from './line-chart';

const RANGES = [
  { key: '1d', label: '1 J', axis: 'time' },
  { key: '1mo', label: '1 M', axis: 'date' },
  { key: '1y', label: '1 A', axis: 'date' },
] as const;

export function InstrumentChart({ instrumentId, name }: { instrumentId: string; name: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);
  const [points, setPoints] = useState<ChartPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setPoints(null);
    setError(null);
    fetch(`/api/instruments/${instrumentId}/series?range=${range.key}`, { signal: ctrl.signal })
      .then(async (res) => {
        const json = (await res.json()) as { points?: ChartPoint[]; error?: string };
        if (!res.ok || !json.points) throw new Error(json.error ?? 'erreur');
        setPoints(json.points);
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'erreur');
      });
    return () => ctrl.abort();
  }, [instrumentId, range]);

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" className="flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            role="tab"
            aria-selected={r.key === range.key}
            onClick={() => setRange(r)}
            className={
              r.key === range.key ? 'btn-primary !px-3 !py-1' : 'btn-secondary !px-3 !py-1'
            }
          >
            {r.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">Graphique indisponible : {error}</p>}
      {!error && !points && <p className="text-sm text-slate-500">Chargement…</p>}
      {points && <LineChart data={points} label={name} axis={range.axis} />}
    </div>
  );
}

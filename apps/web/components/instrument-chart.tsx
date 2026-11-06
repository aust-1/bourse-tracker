'use client';

import { avgCostSeries, type Order } from '@bourse/core';
import { useEffect, useMemo, useState } from 'react';
import { LineChart, type ChartPoint } from './line-chart';

const RANGES = [
  { key: '1d', label: '1 J', axis: 'time' },
  { key: '1mo', label: '1 M', axis: 'date' },
  { key: '1y', label: '1 A', axis: 'date' },
] as const;

export function InstrumentChart({
  instrumentId,
  name,
  orders,
}: {
  instrumentId: string;
  name: string;
  /** Ordres de l'utilisateur sur ce titre : courbe du PRU au fil du temps */
  orders: readonly Order[];
}) {
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

  const data = useMemo(() => {
    if (!points) return null;
    const pru = avgCostSeries(
      orders,
      points.map((p) => p.t),
      range.axis === 'date',
    );
    return points.map((p, i) => ({ ...p, ref: pru[i] }));
  }, [points, orders, range]);

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
      {data && <LineChart data={data} label={name} refLabel="PRU" axis={range.axis} />}
    </div>
  );
}

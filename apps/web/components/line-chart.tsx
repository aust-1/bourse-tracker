'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { eur } from '@/lib/format';

export interface ChartPoint {
  /** Instant en ms depuis l'epoch */
  t: number;
  v: number;
}

interface Props {
  data: readonly ChartPoint[];
  /** Nom de la série (titre du tableau et de l'infobulle) */
  label: string;
  /** 'time' : axe en heures ; 'date' : axe en jours */
  axis: 'time' | 'date';
  height?: number;
}

const tzOpts = { timeZone: 'Europe/Paris' } as const;
const fmtTick = (axis: Props['axis']) => (t: number) =>
  axis === 'time'
    ? new Date(t).toLocaleTimeString('fr-FR', { ...tzOpts, hour: '2-digit', minute: '2-digit' })
    : new Date(t).toLocaleDateString('fr-FR', { ...tzOpts, day: '2-digit', month: 'short' });
const fmtFull = (axis: Props['axis']) => (t: number) =>
  axis === 'time'
    ? new Date(t).toLocaleString('fr-FR', { ...tzOpts, dateStyle: 'short', timeStyle: 'short' })
    : new Date(t).toLocaleDateString('fr-FR', { ...tzOpts, dateStyle: 'medium' });

/** Courbe unique : 2 px, quadrillage horizontal discret, infobulle au survol, vue tableau. */
export function LineChart({ data, label, axis, height = 280 }: Props) {
  if (data.length < 2) {
    return <p className="text-sm text-slate-500">Pas assez de données pour tracer une courbe.</p>;
  }
  const values = data.map((d) => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.1 || max * 0.01;
  const tick = fmtTick(axis);
  const full = fmtFull(axis);
  const step = Math.max(1, Math.ceil(data.length / 60));

  return (
    <figure className="viz-root rounded-lg p-3" style={{ background: 'var(--viz-surface)' }}>
      <figcaption className="mb-2 text-sm" style={{ color: 'var(--viz-text-2)' }}>
        {label}
      </figcaption>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data as ChartPoint[]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              tick={{ fill: 'var(--viz-text-2)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              minTickGap={48}
            />
            <YAxis
              domain={[min - pad, max + pad]}
              tickFormatter={(v: number) => eur(v)}
              tick={{ fill: 'var(--viz-text-2)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={84}
            />
            <Tooltip
              cursor={{ stroke: 'var(--viz-text-2)', strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as ChartPoint | undefined) : undefined;
                if (!p) return null;
                return (
                  <div
                    className="rounded-md border px-3 py-2 text-xs shadow"
                    style={{
                      background: 'var(--viz-surface)',
                      color: 'var(--viz-text)',
                      borderColor: 'var(--viz-grid)',
                    }}
                  >
                    <div style={{ color: 'var(--viz-text-2)' }}>{full(p.t)}</div>
                    <div className="mt-0.5 flex items-center gap-2 font-medium tabular-nums">
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: 'var(--series-1)' }}
                      />
                      {label} : {eur(p.v)}
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="var(--series-1)"
              strokeWidth={2}
              fill="var(--series-1)"
              fillOpacity={0.08}
              dot={false}
              activeDot={{
                r: 4,
                stroke: 'var(--viz-surface)',
                strokeWidth: 2,
                fill: 'var(--series-1)',
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs" style={{ color: 'var(--viz-text-2)' }}>
        <summary className="cursor-pointer">Voir les données en tableau</summary>
        <table className="mt-2 w-full max-w-md">
          <thead>
            <tr>
              <th className="py-1 text-left font-medium">Date</th>
              <th className="py-1 text-right font-medium">{label}</th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter((_, i) => i % step === 0 || i === data.length - 1)
              .map((d) => (
                <tr key={d.t}>
                  <td className="py-0.5">{full(d.t)}</td>
                  <td className="py-0.5 text-right tabular-nums">{eur(d.v)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

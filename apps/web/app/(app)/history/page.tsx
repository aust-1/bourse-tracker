import { parisDate } from '@bourse/core';
import Link from 'next/link';
import { LineChart } from '@/components/line-chart';
import { Pl } from '@/components/pl';
import { eur } from '@/lib/format';
import { buildHistory, isRangeKey, loadCloses, periodStats, RANGES } from '@/lib/history';
import { loadPortfolioData } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range = isRangeKey(rangeParam) ? rangeParam : '3m';

  const supabase = await createClient();
  const { orders, instruments, quotes } = await loadPortfolioData(supabase);
  const ids = [...new Set(orders.map((o) => o.instrumentId))];
  const closes = await loadCloses(supabase, ids);

  const snaps = buildHistory(orders, closes, quotes);
  const stats = periodStats(snaps, range, parisDate(new Date()));

  const withHistory = new Set(closes.map((c) => c.instrumentId));
  const loading = instruments.filter((i) => ids.includes(i.id) && !withHistory.has(i.id));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Historique</h1>

      <nav className="flex flex-wrap gap-1" aria-label="Période">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/history?range=${r.key}`}
            aria-current={r.key === range ? 'page' : undefined}
            className={r.key === range ? 'btn-primary !px-3 !py-1' : 'btn-secondary !px-3 !py-1'}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      {loading.length > 0 && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
          Historique en cours de chargement pour {loading.map((i) => i.name).join(', ')} : le worker
          le récupère, la courbe sera complète dans quelques instants.
        </p>
      )}

      {!stats ? (
        <p className="card text-sm text-slate-500">
          {orders.length === 0
            ? 'Aucun ordre : la courbe apparaîtra dès ton premier ordre.'
            : 'Pas de données sur cette période.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">Valeur actuelle</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {eur(stats.end.marketValue)}
              </p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">Gain sur la période</p>
              <p className="mt-1 text-xl font-semibold">
                <Pl value={stats.gain} />
              </p>
              <p className="mt-1 text-xs text-slate-500">Hors apports (achats et ventes)</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">Rendement</p>
              <p className="mt-1 text-xl font-semibold">
                <Pl value={stats.gainPct} kind="pct" />
              </p>
              <p className="mt-1 text-xs text-slate-500">Base : valeur de départ + apports</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500">Apports nets</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{eur(stats.contributions)}</p>
              <p className="mt-1 text-xs text-slate-500">Achats moins ventes sur la période</p>
            </div>
          </div>

          <LineChart
            label="Valeur du portefeuille"
            axis="date"
            data={stats.points.map((s) => ({
              t: Date.parse(`${s.date}T12:00:00Z`),
              v: s.marketValue,
            }))}
          />
        </>
      )}
    </div>
  );
}

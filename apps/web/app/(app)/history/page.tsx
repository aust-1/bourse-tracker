import { parisDate, rebaseCloses, twrIndex } from '@bourse/core';
import Link from 'next/link';
import { LineChart } from '@/components/line-chart';
import { Pl } from '@/components/pl';
import { loadBenchmarkCloses } from '@/lib/benchmark';
import { loadCash } from '@/lib/cash';
import { eur } from '@/lib/format';
import {
  buildHistory,
  isRangeKey,
  loadCloses,
  periodStats,
  RANGES,
  XIRR_MIN_DAYS,
} from '@/lib/history';
import { portfolioScope } from '@/lib/portfolios';
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
  const { selected } = await portfolioScope(supabase);
  const [{ orders, instruments, quotes }, movements] = await Promise.all([
    loadPortfolioData(supabase, selected?.id ?? null),
    loadCash(supabase, selected?.id ?? null).catch(() => []),
  ]);
  const ids = [...new Set(orders.map((o) => o.instrumentId))];
  const closes = await loadCloses(supabase, ids);

  const snaps = buildHistory(orders, closes, quotes, movements);
  const stats = periodStats(snaps, range, parisDate(new Date()));

  const withHistory = new Set(closes.map((c) => c.instrumentId));
  const loading = instruments.filter((i) => ids.includes(i.id) && !withHistory.has(i.id));

  // comparaison à l'indice de référence choisi dans les réglages (base 100, TWR)
  const { data: settings } = await supabase
    .from('settings')
    .select('benchmark_symbol')
    .maybeSingle();
  const benchmarkSymbol = settings?.benchmark_symbol ?? null;
  let comparison: { t: number; v: number; ref: number | null }[] | null = null;
  let benchmarkPct: number | null = null;
  let benchmarkError = false;
  if (benchmarkSymbol && stats) {
    const benchCloses = await loadBenchmarkCloses(benchmarkSymbol);
    if (benchCloses) {
      const dates = stats.points.map((p) => p.date);
      const portfolio = twrIndex(stats.points, stats.base);
      const bench = rebaseCloses(benchCloses, dates, stats.base?.date ?? dates[0] ?? null);
      comparison = stats.points.map((p, i) => ({
        t: Date.parse(`${p.date}T12:00:00Z`),
        v: portfolio[i]!,
        ref: bench[i] ?? null,
      }));
      const last = bench[bench.length - 1];
      benchmarkPct = last === null || last === undefined ? null : last - 100;
    } else {
      benchmarkError = true;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Historique</h1>
        {selected && <p className="text-sm text-slate-500">{selected.name}</p>}
      </div>

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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="card">
              <p className="text-xs text-slate-500">Valeur actuelle</p>
              <p className="mt-1 display tabular-nums">{eur(stats.end.marketValue)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">Gain sur la période</p>
              <p className="mt-1 display">
                <Pl value={stats.gain} />
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Hors apports (achats et ventes)
                {stats.income !== 0 && <>, dont {eur(stats.income)} de dividendes nets</>}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">Rendement (TWR)</p>
              <p className="mt-1 display">
                <Pl value={stats.twrPct} kind="pct" />
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Pondéré par le temps : hors effet des apports
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">TRI annualisé</p>
              <p className="mt-1 display">
                <Pl value={stats.xirrPct} kind="pct" />
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {stats.xirrPct === null
                  ? `Sur une période d’au moins ${XIRR_MIN_DAYS} jours`
                  : 'Rendement par an de l’argent investi'}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">Apports nets</p>
              <p className="mt-1 display tabular-nums">{eur(stats.contributions)}</p>
              <p className="mt-1 text-xs text-slate-500">Achats moins ventes sur la période</p>
            </div>
          </div>

          <LineChart
            label="Valeur du portefeuille"
            refLabel="Montant investi"
            axis="date"
            data={stats.points.map((s) => ({
              t: Date.parse(`${s.date}T12:00:00Z`),
              v: s.marketValue,
              ref: s.netContributions,
            }))}
          />

          {comparison && (
            <section className="flex flex-col gap-2" aria-label="Comparaison">
              <h2 className="text-lg font-semibold">Comparaison à {benchmarkSymbol}</h2>
              <p className="text-sm" data-testid="benchmark-summary">
                Portefeuille <Pl value={stats.twrPct} kind="pct" /> · {benchmarkSymbol}{' '}
                <Pl value={benchmarkPct} kind="pct" />
                <span className="text-slate-500"> (base 100 au début de la période)</span>
              </p>
              <LineChart
                label="Portefeuille (TWR)"
                refLabel={benchmarkSymbol ?? 'Indice'}
                axis="date"
                unit="index"
                data={comparison}
              />
            </section>
          )}
          {benchmarkError && (
            <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
              Indice {benchmarkSymbol} indisponible pour le moment (source de prix muette ou symbole
              inconnu).
            </p>
          )}
          {!benchmarkSymbol && (
            <p className="text-xs text-slate-500">
              Choisis un indice de référence dans les{' '}
              <Link href="/settings" className="underline">
                Réglages
              </Link>{' '}
              pour comparer ta performance.
            </p>
          )}
        </>
      )}
    </div>
  );
}

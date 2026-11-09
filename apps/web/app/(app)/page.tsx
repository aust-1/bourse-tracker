import { summarizeCash } from '@bourse/core';
import { LiveDashboard } from '@/components/live-dashboard';
import { Sparkline } from '@/components/sparkline';
import { loadCash } from '@/lib/cash';
import { buildHistory, loadCloses } from '@/lib/history';
import { portfolioScope } from '@/lib/portfolios';
import { loadPortfolioData } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();
  const { selected } = await portfolioScope(supabase);
  const [{ orders, instruments, quotes }, movements] = await Promise.all([
    loadPortfolioData(supabase, selected?.id ?? null),
    loadCash(supabase, selected?.id ?? null).catch(() => []),
  ]);
  // liquidités affichées dès qu'un mouvement est enregistré
  const cash = movements.length > 0 ? summarizeCash(orders, movements) : null;

  // mini-courbe : 30 dernières séances (échec de lecture : le tableau de bord reste utilisable)
  let trend: number[];
  let invested: number[];
  try {
    const ids = [...new Set(orders.map((o) => o.instrumentId))];
    const snaps = buildHistory(orders, await loadCloses(supabase, ids), quotes, movements).slice(
      -30,
    );
    trend = snaps.map((s) => s.marketValue);
    invested = snaps.map((s) => s.netContributions);
  } catch {
    trend = [];
    invested = [];
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tableau de bord</h1>
          {selected && <p className="text-sm text-slate-500">{selected.name}</p>}
        </div>
        {trend.length > 1 && (
          <Link href="/history" className="flex flex-col items-end gap-1 text-xs text-slate-500">
            <Sparkline
              values={trend}
              reference={invested}
              label="Valeur du portefeuille et montant investi sur les 30 dernières séances"
            />
            30 dernières séances
          </Link>
        )}
      </div>
      <LiveDashboard
        orders={orders}
        instruments={instruments}
        initialQuotes={quotes}
        cash={
          cash
            ? { balance: cash.balance, deposits: cash.deposits, dividends: cash.dividends }
            : null
        }
      />
    </div>
  );
}

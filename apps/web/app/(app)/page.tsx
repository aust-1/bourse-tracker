import { LiveDashboard } from '@/components/live-dashboard';
import { Sparkline } from '@/components/sparkline';
import { buildHistory, loadCloses } from '@/lib/history';
import { loadPortfolioData } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();
  const { orders, instruments, quotes } = await loadPortfolioData(supabase);

  // mini-courbe : 30 dernières séances (échec de lecture : le tableau de bord reste utilisable)
  let trend: number[];
  try {
    const ids = [...new Set(orders.map((o) => o.instrumentId))];
    trend = buildHistory(orders, await loadCloses(supabase, ids), quotes)
      .slice(-30)
      .map((s) => s.marketValue);
  } catch {
    trend = [];
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        {trend.length > 1 && (
          <Link href="/history" className="flex flex-col items-end gap-1 text-xs text-slate-500">
            <Sparkline values={trend} label="Valeur du portefeuille sur les 30 dernières séances" />
            30 dernières séances
          </Link>
        )}
      </div>
      <LiveDashboard orders={orders} instruments={instruments} initialQuotes={quotes} />
    </div>
  );
}

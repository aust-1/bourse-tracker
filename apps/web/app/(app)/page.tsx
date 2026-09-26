import { LiveDashboard } from '@/components/live-dashboard';
import { loadPortfolioData } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();
  const { orders, instruments, quotes } = await loadPortfolioData(supabase);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>
      <LiveDashboard orders={orders} instruments={instruments} initialQuotes={quotes} />
    </div>
  );
}

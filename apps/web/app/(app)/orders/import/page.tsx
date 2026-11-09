import { ImportForm } from '@/components/import-form';
import { portfolioScope } from '@/lib/portfolios';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const supabase = await createClient();
  const { portfolios, selected } = await portfolioScope(supabase);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Importer des ordres</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Depuis l’export CSV de l’application ou d’un courtier. Un aperçu montre chaque ligne avant
        tout ajout.
      </p>
      <ImportForm
        portfolios={portfolios.map((p) => ({ id: p.id, name: p.name }))}
        defaultPortfolioId={selected?.id ?? portfolios[0]?.id ?? ''}
      />
    </div>
  );
}

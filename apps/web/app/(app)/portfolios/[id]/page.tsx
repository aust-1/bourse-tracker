import { notFound } from 'next/navigation';
import { PortfolioForm } from '@/components/portfolio-form';
import { createClient } from '@/lib/supabase/server';

export default async function EditPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from('portfolios')
    .select('id, name, kind, opened_on')
    .eq('id', id)
    .maybeSingle();
  if (!p) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Modifier le portefeuille</h1>
      <PortfolioForm
        id={p.id}
        values={{ name: p.name, kind: p.kind, openedOn: p.opened_on ?? '' }}
      />
    </div>
  );
}

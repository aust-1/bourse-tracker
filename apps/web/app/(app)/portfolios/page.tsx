import Link from 'next/link';
import { PortfolioForm } from '@/components/portfolio-form';
import { KIND_LABELS, loadPortfolios } from '@/lib/portfolios';
import { createClient } from '@/lib/supabase/server';
import { deletePortfolio } from './actions';

export const dynamic = 'force-dynamic';

export default async function PortfoliosPage() {
  const supabase = await createClient();
  const [portfolios, { data: counts }] = await Promise.all([
    loadPortfolios(supabase),
    supabase.from('orders').select('portfolio_id'),
  ]);
  const orderCount = new Map<string, number>();
  for (const o of counts ?? []) {
    orderCount.set(o.portfolio_id, (orderCount.get(o.portfolio_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Portefeuilles</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Une enveloppe par portefeuille (PEA, PEA-PME, compte-titres). Les ventes sont contrôlées
        portefeuille par portefeuille ; le sélecteur en haut de page filtre tous les écrans.
      </p>
      <section className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="th">Nom</th>
              <th className="th">Type</th>
              <th className="th">Ouvert le</th>
              <th className="th text-right">Ordres</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {portfolios.map((p) => {
              const n = orderCount.get(p.id) ?? 0;
              return (
                <tr key={p.id}>
                  <td className="td">{p.name}</td>
                  <td className="td">{KIND_LABELS[p.kind]}</td>
                  <td className="td">
                    {p.openedOn
                      ? new Date(`${p.openedOn}T12:00:00Z`).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                  <td className="td text-right tabular-nums">{n}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/portfolios/${p.id}`} className="text-sm underline">
                        Modifier
                      </Link>
                      {n === 0 && portfolios.length > 1 && (
                        <form action={deletePortfolio.bind(null, p.id)}>
                          <button className="text-sm text-red-600 underline">Supprimer</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <h2 className="text-lg font-semibold">Nouveau portefeuille</h2>
      <PortfolioForm id={null} values={{ name: '', kind: 'pea', openedOn: '' }} />
    </div>
  );
}

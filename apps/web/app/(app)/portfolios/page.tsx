import { buildPortfolioView, estimatePeaTax, parisDate, summarizeCash } from '@bourse/core';
import Link from 'next/link';
import { PortfolioForm } from '@/components/portfolio-form';
import { loadCash } from '@/lib/cash';
import { eur } from '@/lib/format';
import { KIND_LABELS, loadPortfolios } from '@/lib/portfolios';
import { loadPortfolioData } from '@/lib/queries';
import { DEFAULT_INCOME_RATE, DEFAULT_SOCIAL_RATE } from '@/lib/settings';
import { createClient } from '@/lib/supabase/server';
import { deletePortfolio } from './actions';

export const dynamic = 'force-dynamic';

export default async function PortfoliosPage() {
  const supabase = await createClient();
  const [portfolios, data, cash, { data: settings }] = await Promise.all([
    loadPortfolios(supabase),
    loadPortfolioData(supabase),
    loadCash(supabase),
    supabase.from('settings').select('social_tax_rate, income_tax_rate').maybeSingle(),
  ]);
  const orderCount = new Map<string, number>();
  for (const o of data.orders) {
    orderCount.set(o.portfolioId, (orderCount.get(o.portfolioId) ?? 0) + 1);
  }
  const quotes = new Map(data.quotes.map((q) => [q.instrumentId, q]));
  const today = parisDate(new Date());
  const taxes = portfolios
    .filter((p) => p.kind !== 'cto')
    .map((p) => {
      const orders = data.orders.filter((o) => o.portfolioId === p.id);
      const movements = cash.filter((m) => m.portfolioId === p.id);
      const { totals } = buildPortfolioView(orders, data.instruments, quotes);
      const c = summarizeCash(orders, movements);
      return {
        portfolio: p,
        hasDeposits: c.deposits > 0,
        value: totals.marketValue + c.balance,
        tax: estimatePeaTax({
          openedOn: p.openedOn,
          today,
          value: totals.marketValue + c.balance,
          deposits: c.deposits,
          withdrawals: c.withdrawals,
          socialRate: settings?.social_tax_rate ?? DEFAULT_SOCIAL_RATE,
          incomeRate: settings?.income_tax_rate ?? DEFAULT_INCOME_RATE,
        }),
      };
    });

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

      {taxes.map(({ portfolio: p, hasDeposits, value, tax }) => (
        <section
          key={p.id}
          className="card flex max-w-2xl flex-col gap-2 text-sm"
          aria-label={`Fiscalité ${p.name}`}
        >
          <h2 className="text-lg font-semibold">{p.name} : ancienneté et fiscalité</h2>
          {tax.maturityOn ? (
            <p data-testid="pea-maturity">
              {tax.matured ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  ✔ 5 ans atteints le {tax.maturityOn.split('-').reverse().join('/')}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  5 ans le {tax.maturityOn.split('-').reverse().join('/')} : un retrait avant
                  clôture le plan
                </span>
              )}{' '}
              <span className="text-slate-500">({tax.ageYears} an(s) d’ancienneté)</span>
            </p>
          ) : (
            <p className="text-slate-500">
              Date d’ouverture inconnue :{' '}
              <Link href={`/portfolios/${p.id}`} className="underline">
                renseigne-la
              </Link>{' '}
              pour suivre l’ancienneté.
            </p>
          )}
          {hasDeposits ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">Valeur</dt>
                <dd className="tabular-nums">{eur(value)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Plus-value</dt>
                <dd className="tabular-nums">{eur(tax.gain)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Taux</dt>
                <dd className="tabular-nums">{tax.rate.toLocaleString('fr-FR')} %</dd>
              </div>
              <div>
                <dt className="text-slate-500">Impôt estimé</dt>
                <dd className="tabular-nums" data-testid="pea-tax">
                  {eur(tax.tax)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-slate-500">
              Enregistre tes versements (page Mouvements) pour estimer l’impôt d’un retrait.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Estimation d’un retrait total aujourd’hui : plus-value = valeur − versements nets ;
            prélèvements sociaux{tax.matured ? '' : ' + impôt sur le revenu (avant 5 ans)'}. Taux
            réglables dans les Réglages.
          </p>
        </section>
      ))}

      <h2 className="text-lg font-semibold">Nouveau portefeuille</h2>
      <PortfolioForm id={null} values={{ name: '', kind: 'pea', openedOn: '' }} />
    </div>
  );
}

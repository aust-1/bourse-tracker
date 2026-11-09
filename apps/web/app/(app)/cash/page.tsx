import { capStatus, parisDate, summarizeCash } from '@bourse/core';
import { CapGauge } from '@/components/cap-gauge';
import { CashForm } from '@/components/cash-form';
import { Pl } from '@/components/pl';
import { CASH_LABELS, loadCash } from '@/lib/cash';
import { eur } from '@/lib/format';
import { portfolioScope } from '@/lib/portfolios';
import { loadPortfolioData } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { deleteMovement } from './actions';

export const dynamic = 'force-dynamic';

export default async function CashPage() {
  const supabase = await createClient();
  const { portfolios, selected } = await portfolioScope(supabase);
  const [allCash, { orders, instruments }] = await Promise.all([
    loadCash(supabase),
    loadPortfolioData(supabase, selected?.id ?? null),
  ]);
  const cash = selected ? allCash.filter((m) => m.portfolioId === selected.id) : allCash;
  const summary = summarizeCash(orders, cash);

  // plafonds : versements de toutes les enveloppes PEA / PEA-PME du compte
  const kindOf = new Map(portfolios.map((p) => [p.id, p.kind]));
  const deposits = { pea: 0, pea_pme: 0 };
  for (const m of allCash) {
    const kind = kindOf.get(m.portfolioId);
    if (m.kind === 'deposit' && (kind === 'pea' || kind === 'pea_pme')) deposits[kind] += m.amount;
  }
  const caps = capStatus(deposits);
  const hasPea = portfolios.some((p) => p.kind === 'pea');
  const hasPme = portfolios.some((p) => p.kind === 'pea_pme');

  const names = new Map(portfolios.map((p) => [p.id, p.name]));
  const instrumentNames = new Map(instruments.map((i) => [i.id, i.name]));
  const showPortfolio = !selected && portfolios.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Mouvements</h1>
        {selected && <p className="text-sm text-slate-500">{selected.name}</p>}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Versements, retraits, dividendes et frais. Avec les ordres, ils donnent le solde de
        liquidités et le suivi du plafond de versements.
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Liquidités">
        <div className="card">
          <p className="text-xs text-slate-500">Liquidités</p>
          <p className="display mt-1 tabular-nums" data-testid="cash-balance">
            <span className={summary.balance < 0 ? 'text-red-600' : ''}>
              {eur(summary.balance)}
            </span>
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">Versements cumulés</p>
          <p className="display mt-1 tabular-nums">{eur(summary.deposits)}</p>
          {summary.withdrawals > 0 && (
            <p className="mt-1 text-xs text-slate-500">retraits : {eur(summary.withdrawals)}</p>
          )}
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">Dividendes reçus</p>
          <p className="display mt-1 tabular-nums">{eur(summary.dividends)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">Frais (hors courtage)</p>
          <p className="display mt-1 tabular-nums">{eur(summary.fees)}</p>
        </div>
      </section>
      {summary.balance < 0 && summary.deposits === 0 && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
          Aucun versement enregistré : le solde négatif correspond aux achats. Ajoute tes versements
          pour suivre les liquidités.
        </p>
      )}

      {(hasPea || hasPme) && (
        <section className="card flex max-w-2xl flex-col gap-4" aria-label="Plafonds">
          <h2 className="text-lg font-semibold">Plafonds de versements</h2>
          {hasPea && <CapGauge label="PEA" status={caps.pea} />}
          {hasPme && <CapGauge label="PEA + PEA-PME" status={caps.combined} />}
          <p className="text-xs text-slate-500">
            Versements cumulés depuis l’ouverture ; les retraits ne reconstituent pas le plafond.
          </p>
        </section>
      )}

      <h2 className="text-lg font-semibold">Nouveau mouvement</h2>
      <CashForm
        portfolios={portfolios}
        instruments={instruments.map((i) => ({ id: i.id, name: i.name, symbol: i.symbol }))}
        defaultPortfolioId={selected?.id ?? portfolios[0]?.id ?? ''}
        today={parisDate(new Date())}
      />

      <section className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="th">Date</th>
              {showPortfolio && <th className="th">Portefeuille</th>}
              <th className="th">Type</th>
              <th className="th">Détail</th>
              <th className="th text-right">Montant</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {cash.length === 0 && (
              <tr>
                <td className="td text-slate-500" colSpan={showPortfolio ? 6 : 5}>
                  Aucun mouvement.
                </td>
              </tr>
            )}
            {[...cash].reverse().map((m) => (
              <tr key={m.id}>
                <td className="td whitespace-nowrap">
                  {m.occurredOn.split('-').reverse().join('/')}
                </td>
                {showPortfolio && <td className="td">{names.get(m.portfolioId)}</td>}
                <td className="td">{CASH_LABELS[m.kind]}</td>
                <td className="td text-sm">
                  {m.instrumentId ? instrumentNames.get(m.instrumentId) : ''}
                  {m.note && <span className="text-slate-500"> {m.note}</span>}
                </td>
                <td className="td text-right tabular-nums">
                  <Pl
                    value={m.kind === 'deposit' || m.kind === 'dividend' ? m.amount : -m.amount}
                  />
                </td>
                <td className="td text-right">
                  <form action={deleteMovement.bind(null, m.id)}>
                    <button className="text-sm text-red-600 underline">Supprimer</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

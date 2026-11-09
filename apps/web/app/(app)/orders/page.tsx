import { fetchAll } from '@bourse/db';
import Link from 'next/link';
import { dateTime, eur, num } from '@/lib/format';
import {
  dateBounds,
  netAmount,
  PAGE_SIZE,
  pageHref,
  parseFilters,
  selectionTotals,
} from '@/lib/orders-list';
import { portfolioScope } from '@/lib/portfolios';
import { createClient } from '@/lib/supabase/server';

type Search = Promise<Record<string, string | undefined>>;

export default async function OrdersPage({ searchParams }: { searchParams: Search }) {
  const filters = parseFilters(await searchParams);
  const { gte, lt } = dateBounds(filters);
  const supabase = await createClient();
  const { portfolios, selected } = await portfolioScope(supabase);
  const showPortfolio = !selected && portfolios.length > 1;

  // une requête neuve par page : un même constructeur ne doit pas être réutilisé avec .range()
  const query = (from: number, to: number) => {
    let q = supabase
      .from('orders')
      .select(
        'id, side, quantity, unit_price, fees, executed_at, note, instruments(id, yahoo_symbol, name), portfolios(name)',
      )
      .order('executed_at', { ascending: false })
      .order('id');
    if (selected) q = q.eq('portfolio_id', selected.id);
    if (filters.instrument) q = q.eq('instrument_id', filters.instrument);
    if (filters.side) q = q.eq('side', filters.side);
    if (gte) q = q.gte('executed_at', gte);
    if (lt) q = q.lt('executed_at', lt);
    return q.range(from, to);
  };

  // objet plutôt que variable : TypeScript ne voit pas les affectations faites dans un callback
  const load = { error: null as string | null };
  const [orders, { data: instruments }] = await Promise.all([
    // toute la sélection : les totaux portent sur elle, la page n'en affiche qu'une tranche
    fetchAll(query).catch((e: Error) => {
      load.error = e.message;
      return [];
    }),
    supabase.from('instruments').select('id, yahoo_symbol, name').order('name'),
  ]);

  const totals = selectionTotals(orders);
  const pages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const shown = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtered = !!(filters.instrument || filters.side || filters.from || filters.to);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ordres</h1>
          {selected && <p className="text-sm text-slate-500">{selected.name}</p>}
        </div>
        <div className="flex gap-2">
          <a href="/orders/export" className="btn-secondary">
            Export CSV
          </a>
          <Link href="/orders/new" className="btn-primary">
            Nouvel ordre
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <select
          name="instrument"
          defaultValue={filters.instrument ?? ''}
          aria-label="Instrument"
          className="input w-auto"
        >
          <option value="">Tous les instruments</option>
          {instruments?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.yahoo_symbol})
            </option>
          ))}
        </select>
        <select
          name="side"
          defaultValue={filters.side ?? ''}
          aria-label="Sens"
          className="input w-auto"
        >
          <option value="">Achats et ventes</option>
          <option value="buy">Achats</option>
          <option value="sell">Ventes</option>
        </select>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Du
          <input type="date" name="from" defaultValue={filters.from ?? ''} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Au
          <input type="date" name="to" defaultValue={filters.to ?? ''} className="input" />
        </label>
        <button className="btn-secondary">Filtrer</button>
        {filtered && (
          <Link href="/orders" className="text-sm underline">
            Effacer les filtres
          </Link>
        )}
      </form>

      {load.error && <p className="text-sm text-red-600">Erreur de chargement : {load.error}</p>}

      {orders.length > 0 && (
        <p className="text-sm" data-testid="orders-totals">
          {totals.count} ordre{totals.count > 1 ? 's' : ''} · achats {eur(totals.bought)} · ventes{' '}
          {eur(totals.sold)} · frais {eur(totals.fees)}
        </p>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="th">Date</th>
              {showPortfolio && <th className="th">Portefeuille</th>}
              <th className="th">Instrument</th>
              <th className="th">Sens</th>
              <th className="th text-right">Quantité</th>
              <th className="th text-right">Prix</th>
              <th className="th text-right">Frais</th>
              <th className="th text-right" title="Achat : frais compris ; vente : nette de frais">
                Montant net
              </th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {orders.length === 0 && (
              <tr>
                <td className="td text-slate-500" colSpan={showPortfolio ? 9 : 8}>
                  {filtered
                    ? 'Aucun ordre ne correspond aux filtres.'
                    : 'Aucun ordre. Ajoute ton premier ordre pour commencer.'}
                </td>
              </tr>
            )}
            {shown.map((o) => (
              <tr key={o.id}>
                <td className="td whitespace-nowrap">{dateTime(o.executed_at)}</td>
                {showPortfolio && <td className="td">{o.portfolios?.name}</td>}
                <td className="td">
                  {o.instruments?.name}{' '}
                  <span className="text-xs text-slate-500">{o.instruments?.yahoo_symbol}</span>
                </td>
                <td className="td">{o.side === 'buy' ? 'Achat' : 'Vente'}</td>
                <td className="td text-right tabular-nums">{num(o.quantity)}</td>
                <td className="td text-right tabular-nums">{eur(o.unit_price)}</td>
                <td className="td text-right tabular-nums">{eur(o.fees)}</td>
                <td className="td text-right tabular-nums">{eur(netAmount(o))}</td>
                <td className="td text-right">
                  <Link href={`/orders/${o.id}`} className="text-sm underline">
                    Modifier
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label="Pages">
          {page > 1 ? (
            <Link href={pageHref(filters, page - 1)} className="underline">
              ← Précédents
            </Link>
          ) : (
            <span className="text-slate-400">← Précédents</span>
          )}
          <span>
            Page {page} / {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(filters, page + 1)} className="underline">
              Suivants →
            </Link>
          ) : (
            <span className="text-slate-400">Suivants →</span>
          )}
        </nav>
      )}
    </div>
  );
}

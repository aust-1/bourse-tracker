import { fetchAll } from '@bourse/db';
import Link from 'next/link';
import { dateTime, eur, num } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

type Search = Promise<{ instrument?: string; side?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: Search }) {
  const { instrument, side } = await searchParams;
  const supabase = await createClient();

  // une requête neuve par page : un même constructeur ne doit pas être réutilisé avec .range()
  const page = (from: number, to: number) => {
    let query = supabase
      .from('orders')
      .select(
        'id, side, quantity, unit_price, fees, executed_at, note, instruments(id, yahoo_symbol, name)',
      )
      .order('executed_at', { ascending: false })
      .order('id');
    if (instrument) query = query.eq('instrument_id', instrument);
    if (side === 'buy' || side === 'sell') query = query.eq('side', side);
    return query.range(from, to);
  };

  // objet plutôt que variable : TypeScript ne voit pas les affectations faites dans un callback
  const load = { error: null as string | null };
  const [orders, { data: instruments }] = await Promise.all([
    fetchAll(page).catch((e: Error) => {
      load.error = e.message;
      return [];
    }),
    supabase.from('instruments').select('id, yahoo_symbol, name').order('name'),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Ordres</h1>
        <div className="flex gap-2">
          <a href="/orders/export" className="btn-secondary">
            Export CSV
          </a>
          <Link href="/orders/new" className="btn-primary">
            Nouvel ordre
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap gap-3" method="get">
        <select name="instrument" defaultValue={instrument ?? ''} className="input w-auto">
          <option value="">Tous les instruments</option>
          {instruments?.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.yahoo_symbol})
            </option>
          ))}
        </select>
        <select name="side" defaultValue={side ?? ''} className="input w-auto">
          <option value="">Achats et ventes</option>
          <option value="buy">Achats</option>
          <option value="sell">Ventes</option>
        </select>
        <button className="btn-secondary">Filtrer</button>
      </form>

      {load.error && <p className="text-sm text-red-600">Erreur de chargement : {load.error}</p>}

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="th">Date</th>
              <th className="th">Instrument</th>
              <th className="th">Sens</th>
              <th className="th text-right">Quantité</th>
              <th className="th text-right">Prix</th>
              <th className="th text-right">Frais</th>
              <th className="th text-right">Montant</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {orders?.length === 0 && (
              <tr>
                <td className="td text-slate-500" colSpan={8}>
                  Aucun ordre. Ajoute ton premier ordre pour commencer.
                </td>
              </tr>
            )}
            {orders?.map((o) => (
              <tr key={o.id}>
                <td className="td whitespace-nowrap">{dateTime(o.executed_at)}</td>
                <td className="td">
                  {o.instruments?.name}{' '}
                  <span className="text-xs text-slate-500">{o.instruments?.yahoo_symbol}</span>
                </td>
                <td className="td">{o.side === 'buy' ? 'Achat' : 'Vente'}</td>
                <td className="td text-right tabular-nums">{num(o.quantity)}</td>
                <td className="td text-right tabular-nums">{eur(o.unit_price)}</td>
                <td className="td text-right tabular-nums">{eur(o.fees)}</td>
                <td className="td text-right tabular-nums">{eur(o.quantity * o.unit_price)}</td>
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
    </div>
  );
}

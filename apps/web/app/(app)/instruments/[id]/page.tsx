import { computePosition, valuePosition } from '@bourse/core';
import { fetchAll } from '@bourse/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InstrumentChart } from '@/components/instrument-chart';
import { Pl } from '@/components/pl';
import { dateTime, eur, num } from '@/lib/format';
import { portfolioScope } from '@/lib/portfolios';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function InstrumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { selected } = await portfolioScope(supabase);

  const [inst, orders, quote, dividends] = await Promise.all([
    supabase
      .from('instruments')
      .select('id, yahoo_symbol, name, exchange')
      .eq('id', id)
      .maybeSingle(),
    fetchAll((from, to) => {
      let q = supabase
        .from('orders')
        .select('id, side, quantity, unit_price, fees, executed_at')
        .eq('instrument_id', id);
      if (selected) q = q.eq('portfolio_id', selected.id);
      return q.order('executed_at', { ascending: false }).order('id').range(from, to);
    }),
    supabase.from('quotes_latest').select('*').eq('instrument_id', id).maybeSingle(),
    (() => {
      let q = supabase
        .from('cash_movements')
        .select('amount, occurred_on')
        .eq('instrument_id', id)
        .eq('kind', 'dividend');
      if (selected) q = q.eq('portfolio_id', selected.id);
      return q.order('occurred_on', { ascending: false });
    })(),
  ]);
  if (!inst.data) notFound();
  const dividendTotal = (dividends.data ?? []).reduce((s, d) => s + Number(d.amount), 0);

  const myOrders = orders.map((o) => ({
    id: o.id,
    side: o.side,
    quantity: o.quantity,
    unitPrice: o.unit_price,
    fees: o.fees,
    executedAt: o.executed_at,
  }));
  const pos = computePosition(myOrders);
  const v = quote.data ? valuePosition(pos, quote.data.price, quote.data.prev_close) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{inst.data.name}</h1>
          <p className="text-sm text-slate-500">
            {inst.data.yahoo_symbol} · {inst.data.exchange}
          </p>
        </div>
        {quote.data && (
          <div className="text-right">
            <p className="display tabular-nums">{eur(quote.data.price)}</p>
            <Pl value={v?.dayChangePct ?? null} kind="pct" />
          </div>
        )}
      </div>

      <InstrumentChart instrumentId={inst.data.id} name={inst.data.name} orders={myOrders} />

      <section className="card">
        <h2 className="mb-2 text-sm font-medium">Ma position</h2>
        {pos.quantity > 0 ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Quantité</dt>
              <dd className="tabular-nums">{num(pos.quantity)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">PRU</dt>
              <dd className="tabular-nums">{eur(pos.avgCost)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Valeur</dt>
              <dd className="tabular-nums">{v ? eur(v.marketValue) : '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">+/- latente</dt>
              <dd>
                <Pl value={v?.unrealizedPl ?? null} />{' '}
                <Pl value={v?.unrealizedPlPct ?? null} kind="pct" />
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Aucune position ouverte.</p>
        )}
        <p className="mt-2 text-sm">
          Gain réalisé : <Pl value={pos.realizedPl} />
        </p>
        {dividendTotal > 0 && (
          <p className="mt-1 text-sm" data-testid="instrument-dividends">
            Dividendes reçus : {eur(dividendTotal)} ({dividends.data!.length} versement
            {dividends.data!.length > 1 ? 's' : ''}, dernier le{' '}
            {dividends.data![0]!.occurred_on.split('-').reverse().join('/')})
          </p>
        )}
      </section>

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Mes ordres</h2>
          <Link href="/orders/new" className="text-sm underline">
            Nouvel ordre
          </Link>
        </div>
        {orders.length ? (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {orders.map((o) => (
              <li key={o.id} className="flex justify-between gap-3 py-1.5">
                <span>
                  {dateTime(o.executed_at)} · {o.side === 'buy' ? 'Achat' : 'Vente'}{' '}
                  {num(o.quantity)}
                </span>
                <span className="tabular-nums">{eur(o.unit_price)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Aucun ordre.</p>
        )}
      </section>

      <p className="text-sm">
        <Link href={`/alerts?instrument=${inst.data.id}`} className="underline">
          Voir les alertes de ce titre
        </Link>
      </p>
    </div>
  );
}

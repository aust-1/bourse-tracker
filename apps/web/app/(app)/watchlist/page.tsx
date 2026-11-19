import Link from 'next/link';
import { Pl } from '@/components/pl';
import { WatchForm } from '@/components/watch-form';
import { dateTime, eur } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { setWatched } from './actions';

export const dynamic = 'force-dynamic';

/** Liste de suivi : titres suivis sans les détenir (cours, variation, alertes, historique). */
export default async function WatchlistPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_instruments')
    .select('instrument_id, watched_since, instruments(name, yahoo_symbol)')
    .eq('watched', true)
    .order('watched_since', { ascending: true });
  if (error) throw new Error(error.message);
  const ids = data.map((w) => w.instrument_id);
  const { data: quotes } = ids.length
    ? await supabase
        .from('quotes_latest')
        .select('instrument_id, price, prev_close, quoted_at')
        .in('instrument_id', ids)
    : { data: [] };
  const quoteOf = new Map((quotes ?? []).map((q) => [q.instrument_id, q]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Suivi</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Des titres à surveiller sans les détenir : le worker les cote et garde leur historique, tu
        peux leur poser des alertes.
      </p>
      <WatchForm />

      {data.length === 0 ? (
        <p className="card text-sm text-slate-500">Aucun titre suivi pour le moment.</p>
      ) : (
        <section className="card overflow-x-auto p-0" aria-label="Titres suivis">
          <table className="w-full">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="th">Titre</th>
                <th className="th text-right">Cours</th>
                <th className="th text-right">Jour</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((w) => {
                const q = quoteOf.get(w.instrument_id);
                const day =
                  q && q.prev_close ? (Number(q.price) / Number(q.prev_close) - 1) * 100 : null;
                return (
                  <tr key={w.instrument_id}>
                    <td className="td">
                      <Link
                        href={`/instruments/${w.instrument_id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {w.instruments?.name ?? '—'}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {w.instruments?.yahoo_symbol}
                        {q && <> · {dateTime(q.quoted_at)}</>}
                      </div>
                    </td>
                    <td className="td text-right tabular-nums">
                      {q ? (
                        eur(Number(q.price))
                      ) : (
                        <span className="text-slate-500">en attente</span>
                      )}
                    </td>
                    <td className="td text-right">
                      <Pl value={day} kind="pct" />
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-3 text-sm">
                        <Link
                          href={`/alerts/new?instrument=${w.instrument_id}`}
                          className="underline"
                        >
                          Créer une alerte
                        </Link>
                        <form action={setWatched.bind(null, w.instrument_id, false)}>
                          <button className="underline">Retirer</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

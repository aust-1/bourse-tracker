import { notFound } from 'next/navigation';
import { dateTime, eur } from '@/lib/format';
import { ago, quoteHealth, workerHealth } from '@/lib/supervision';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Failure {
  symbol: string;
  error: string;
}

export default async function SupervisionPage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) notFound();

  const [{ data: status }, { data: instruments, error }] = await Promise.all([
    supabase.from('worker_status').select('*').maybeSingle(),
    supabase.rpc('admin_supervision'),
  ]);
  const now = new Date();
  const health = workerHealth(status?.last_cycle_at ?? null, now);
  const failed = (status?.failed ?? []) as unknown as Failure[];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Supervision</h1>

      <section className="card flex flex-col gap-2" aria-label="Worker">
        <h2 className="text-lg font-semibold">Worker</h2>
        <p data-testid="worker-health">
          {health === 'ok' && (
            <span className="text-emerald-600 dark:text-emerald-400">● En marche</span>
          )}
          {health === 'late' && <span className="text-red-600">● Muet</span>}
          {health === 'unknown' && <span className="text-slate-500">● Jamais lancé</span>}
          {status?.last_cycle_at && (
            <span className="ml-2 text-sm text-slate-500">
              dernier cycle il y a {ago(status.last_cycle_at, now)} (
              {dateTime(status.last_cycle_at)})
            </span>
          )}
        </p>
        <p className="text-sm">
          Dernier cycle de cotation :{' '}
          {status?.last_poll_at ? `${dateTime(status.last_poll_at)}` : '—'}
        </p>
        {status?.last_error && (
          <p role="alert" className="text-sm text-red-600">
            Dernière erreur : {status.last_error}
          </p>
        )}
        {failed.length > 0 && (
          <div className="text-sm">
            <p className="text-amber-600 dark:text-amber-400">
              {failed.length} échec(s) au dernier cycle de cotation :
            </p>
            <ul className="ml-4 list-disc">
              {failed.map((f) => (
                <li key={f.symbol}>
                  {f.symbol} : {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600">Erreur de chargement : {error.message}</p>}
      <section className="card overflow-x-auto p-0" aria-label="Cotes">
        <table className="w-full">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="th">Instrument</th>
              <th className="th text-right">Cours</th>
              <th className="th">Cote</th>
              <th className="th">Dernière lecture</th>
              <th className="th">Dernière clôture</th>
              <th className="th text-right">Comptes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {instruments?.length === 0 && (
              <tr>
                <td className="td text-slate-500" colSpan={6}>
                  Aucun instrument suivi.
                </td>
              </tr>
            )}
            {instruments?.map((i) => {
              const q = quoteHealth(i.quoted_at, now);
              return (
                <tr key={i.instrument_id}>
                  <td className="td">
                    {i.name} <span className="text-xs text-slate-500">{i.yahoo_symbol}</span>
                  </td>
                  <td className="td text-right tabular-nums">
                    {i.price === null ? '—' : eur(i.price)}
                  </td>
                  <td className="td whitespace-nowrap">
                    {q.kind === 'missing' && <span className="text-red-600">Aucune cote</span>}
                    {q.kind === 'live' && (
                      <span className="text-emerald-600 dark:text-emerald-400">En direct</span>
                    )}
                    {q.kind === 'delayed' && (
                      <span className="text-amber-600 dark:text-amber-400">
                        Différée de {q.minutes} min
                      </span>
                    )}
                    {q.kind === 'closed' && i.quoted_at && (
                      <span className="text-slate-500">{dateTime(i.quoted_at)}</span>
                    )}
                  </td>
                  <td className="td whitespace-nowrap text-sm">
                    {i.fetched_at ? `il y a ${ago(i.fetched_at, now)}` : '—'}
                  </td>
                  <td className="td whitespace-nowrap">{i.last_close_date ?? '—'}</td>
                  <td className="td text-right tabular-nums">{i.followers}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

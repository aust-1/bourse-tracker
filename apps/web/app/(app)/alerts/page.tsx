import { describeCondition } from '@bourse/core';
import Link from 'next/link';
import { dateTime, eur, pct } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { deleteAlert, setAlertStatus } from './actions';

export const dynamic = 'force-dynamic';

const STATUS = {
  active: { label: 'Active', cls: 'text-emerald-600 dark:text-emerald-400' },
  triggered: { label: 'Déclenchée', cls: 'text-amber-600 dark:text-amber-400' },
  paused: { label: 'En pause', cls: 'text-slate-500' },
} as const;

const CHANNEL_LABEL: Record<string, string> = { discord: 'Discord', email: 'Email' };

function deliveryText(delivery: unknown): string {
  if (!delivery || typeof delivery !== 'object') return '';
  return Object.entries(delivery as Record<string, string>)
    .map(([c, s]) => {
      const name = CHANNEL_LABEL[c] ?? c;
      if (s === 'sent') return `${name} : envoyé`;
      if (s === 'not_configured') return `${name} : non configuré`;
      return `${name} : échec (${s.replace(/^error: /, '')})`;
    })
    .join(' · ');
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ instrument?: string; notice?: string }>;
}) {
  const { instrument, notice } = await searchParams;
  const supabase = await createClient();

  let alertsQuery = supabase
    .from('alerts')
    .select(
      'id, type, threshold, channels, status, last_triggered_at, instruments(id, name, yahoo_symbol)',
    )
    .order('created_at', { ascending: false });
  if (instrument) alertsQuery = alertsQuery.eq('instrument_id', instrument);

  const [alerts, events] = await Promise.all([
    alertsQuery,
    supabase
      .from('alert_events')
      .select(
        'id, value_at_trigger, triggered_at, delivery, alerts(type, threshold, instruments(name, yahoo_symbol))',
      )
      .order('triggered_at', { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Alertes</h1>
        <Link
          href={instrument ? `/alerts/new?instrument=${instrument}` : '/alerts/new'}
          className="btn-primary"
        >
          Nouvelle alerte
        </Link>
      </div>

      {notice === 'already_true' && (
        <p role="status" className="card text-sm text-amber-700 dark:text-amber-400">
          Alerte créée, mais sa condition est déjà remplie : elle partira dès le prochain cycle en
          séance.
        </p>
      )}

      <section className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="th">Titre</th>
              <th className="th">Condition</th>
              <th className="th">Canaux</th>
              <th className="th">Statut</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {alerts.data?.length === 0 && (
              <tr>
                <td className="td text-slate-500" colSpan={5}>
                  Aucune alerte.
                </td>
              </tr>
            )}
            {alerts.data?.map((a) => {
              const st = STATUS[a.status];
              return (
                <tr key={a.id}>
                  <td className="td">
                    {a.instruments?.name}{' '}
                    <span className="text-xs text-slate-500">{a.instruments?.yahoo_symbol}</span>
                  </td>
                  <td className="td">{describeCondition(a.type, a.threshold)}</td>
                  <td className="td">{a.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(', ')}</td>
                  <td className="td">
                    <span className={st.cls}>{st.label}</span>
                    {a.last_triggered_at && (
                      <div className="text-xs text-slate-500">{dateTime(a.last_triggered_at)}</div>
                    )}
                  </td>
                  <td className="td">
                    <div className="flex justify-end gap-3 text-sm">
                      {a.status === 'triggered' && (
                        <form action={setAlertStatus.bind(null, a.id, 'active')}>
                          <button className="underline">Ré-armer</button>
                        </form>
                      )}
                      {a.status === 'active' && (
                        <form action={setAlertStatus.bind(null, a.id, 'paused')}>
                          <button className="underline">Pause</button>
                        </form>
                      )}
                      {a.status === 'paused' && (
                        <form action={setAlertStatus.bind(null, a.id, 'active')}>
                          <button className="underline">Reprendre</button>
                        </form>
                      )}
                      <form action={deleteAlert.bind(null, a.id)}>
                        <button className="text-red-600 underline">Supprimer</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Historique</h2>
        {events.data?.length === 0 && (
          <p className="text-sm text-slate-500">Aucune alerte déclenchée pour le moment.</p>
        )}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {events.data?.map((e) => {
            const a = e.alerts;
            const isPrice = a?.type.startsWith('price');
            return (
              <li key={e.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <span>
                  <span className="text-slate-500">{dateTime(e.triggered_at)}</span> ·{' '}
                  {a?.instruments?.name} : {a && describeCondition(a.type, a.threshold)} (mesuré :{' '}
                  {isPrice ? eur(e.value_at_trigger) : pct(e.value_at_trigger)})
                </span>
                <span className="text-xs text-slate-500">{deliveryText(e.delivery)}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

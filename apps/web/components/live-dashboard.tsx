'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { dateTime, eur, num } from '@/lib/format';
import {
  buildPortfolioView,
  quoteFreshness,
  type InstrumentRow,
  type OrderRow,
  type QuoteRow,
} from '@bourse/core';
import { loadQuotes, toQuoteRow } from '@/lib/queries';
import { createClient } from '@/lib/supabase/browser';
import { Pl } from './pl';

const POLL_MS = 15_000;

function FreshnessBadge({ quotedAt, now }: { quotedAt: string; now: Date | null }) {
  if (!now) return null;
  const f = quoteFreshness(quotedAt, now);
  if (f.kind === 'live')
    return <span className="text-xs text-emerald-600 dark:text-emerald-400">● En direct</span>;
  if (f.kind === 'delayed')
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">
        ◐ Différé de {f.minutes} min
      </span>
    );
  return <span className="text-xs text-slate-500">Clôture {dateTime(f.at)}</span>;
}

function Stat({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{children}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function LiveDashboard(props: {
  orders: OrderRow[];
  instruments: InstrumentRow[];
  initialQuotes: QuoteRow[];
}) {
  const [quotes, setQuotes] = useState(
    () => new Map(props.initialQuotes.map((q) => [q.instrumentId, q])),
  );
  // null tant que le composant n'est pas monté : évite un écart d'hydratation serveur/client
  const [now, setNow] = useState<Date | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    setNow(new Date());

    const refresh = async () => {
      try {
        const rows = await loadQuotes(supabase);
        if (alive) setQuotes(new Map(rows.map((q) => [q.instrumentId, q])));
      } catch {
        // on garde les dernières cotes affichées
      }
      if (alive) setNow(new Date());
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Le canal doit porter le JWT de l'utilisateur : avec la clé anonyme, la RLS
    // filtrerait tous les événements alors que l'abonnement paraîtrait actif.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel('quotes-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quotes_latest' },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const q = toQuoteRow(payload.new as Parameters<typeof toQuoteRow>[0]);
            setQuotes((prev) => new Map(prev).set(q.instrumentId, q));
            setNow(new Date());
          },
        )
        .subscribe((status) => setConnected(status === 'SUBSCRIBED'));
    })();

    // filet de sécurité : rattrape les événements manqués et fait vieillir les badges
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const { rows, totals } = useMemo(
    () => buildPortfolioView(props.orders, props.instruments, quotes),
    [props.orders, props.instruments, quotes],
  );

  if (props.orders.length === 0) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Aucun ordre pour le moment.{' '}
          <Link href="/orders/new" className="underline">
            Ajoute ton premier ordre
          </Link>{' '}
          pour voir ton portefeuille.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Valeur du portefeuille">{eur(totals.marketValue)}</Stat>
        <Stat
          label="Variation du jour"
          hint={
            totals.sessionDate
              ? `Séance du ${totals.sessionDate.split('-').reverse().join('/')}`
              : undefined
          }
        >
          <Pl value={totals.dayPl} /> <Pl value={totals.dayPlPct} kind="pct" className="text-sm" />
        </Stat>
        <Stat label="Gain latent">
          <Pl value={totals.unrealizedPl} />{' '}
          <Pl value={totals.unrealizedPlPct} kind="pct" className="text-sm" />
        </Stat>
        <Stat label="Gain réalisé">
          <Pl value={totals.realizedPl} />
        </Stat>
      </div>

      {totals.missingQuotes > 0 && (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
          {totals.missingQuotes} ligne(s) sans cotation : valorisée(s) à leur prix de revient en
          attendant le prochain cycle du worker.
        </p>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="th">Titre</th>
              <th className="th text-right">Qté</th>
              <th className="th text-right">PRU</th>
              <th className="th text-right">Cours</th>
              <th className="th text-right">Jour</th>
              <th className="th text-right">Valeur</th>
              <th className="th text-right">+/- latente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.instrumentId}>
                <td className="td">
                  <Link
                    href={`/instruments/${r.instrumentId}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {r.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {r.symbol}
                    {r.quote && now && (
                      <>
                        {' · '}
                        <FreshnessBadge quotedAt={r.quote.quotedAt} now={now} />
                      </>
                    )}
                  </div>
                </td>
                <td className="td text-right tabular-nums">{num(r.quantity)}</td>
                <td className="td text-right tabular-nums">{eur(r.avgCost)}</td>
                <td className="td text-right tabular-nums">{r.quote ? eur(r.quote.price) : '—'}</td>
                <td className="td text-right">
                  <Pl value={r.dayChangePct} kind="pct" />
                </td>
                <td className="td text-right tabular-nums">
                  {r.marketValue === null ? '—' : eur(r.marketValue)}
                </td>
                <td className="td text-right">
                  <div>
                    <Pl value={r.unrealizedPl} />
                  </div>
                  <div className="text-xs">
                    <Pl value={r.unrealizedPlPct} kind="pct" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        {connected ? '● Connexion temps réel active' : '○ Rafraîchissement toutes les 15 s'}
        {now && ` · Mis à jour à ${now.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' })}`}
      </p>
    </div>
  );
}

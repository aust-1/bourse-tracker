import { fetchAll } from '@bourse/db';
import { NextResponse } from 'next/server';
import { parisDate } from '@bourse/core';
import { createClient } from '@/lib/supabase/server';

/**
 * Export de toutes ses données (droit à la portabilité) : un fichier JSON lisible.
 * La RLS limite chaque lecture au compte connecté.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse('Connexion requise', { status: 401 });

  try {
    const [profile, settings, instruments, orders, alerts, alertEvents, portfolios, cash] =
      await Promise.all([
        supabase.from('profiles').select('is_admin, created_at').maybeSingle(),
        supabase.from('settings').select('*').maybeSingle(),
        supabase.from('instruments').select('id, isin, yahoo_symbol, name, exchange, currency'),
        fetchAll((from, to) =>
          supabase.from('orders').select('*').order('executed_at').order('id').range(from, to),
        ),
        supabase.from('alerts').select('*').order('created_at'),
        fetchAll((from, to) =>
          supabase
            .from('alert_events')
            .select('*')
            .order('triggered_at')
            .order('id')
            .range(from, to),
        ),
        supabase.from('portfolios').select('*').order('created_at'),
        fetchAll((from, to) =>
          supabase
            .from('cash_movements')
            .select('*')
            .order('occurred_on')
            .order('id')
            .range(from, to),
        ),
      ]);
    for (const r of [profile, settings, instruments, alerts, portfolios])
      if (r.error) throw r.error;

    const body = {
      exportedAt: new Date().toISOString(),
      account: { id: auth.user.id, email: auth.user.email, ...profile.data },
      settings: settings.data,
      instruments: instruments.data,
      portfolios: portfolios.data,
      orders,
      cashMovements: cash,
      alerts: alerts.data,
      alertEvents,
    };
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="bourse-tracker-${parisDate(new Date())}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as { message?: string }).message);
    return new NextResponse(`Export impossible : ${message}`, { status: 500 });
  }
}

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { CopyLink, InvitationForm } from '@/components/invitation-form';
import { dateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { revokeInvitation } from './actions';

export const dynamic = 'force-dynamic';

/** Origine publique du site (derrière Traefik : en-têtes X-Forwarded-*). */
async function siteOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function InvitationsPage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) notFound();

  const [{ data: invitations }, origin] = await Promise.all([
    supabase
      .from('invitations')
      .select('id, code, note, created_at, expires_at, used_email, used_at')
      .order('created_at', { ascending: false }),
    siteOrigin(),
  ]);
  const now = Date.now();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Invitations</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Chaque lien crée un seul compte et expire au bout de 7 jours. Les comptes invités ont leurs
        propres ordres, alertes et réglages : ils ne voient rien des tiens.
      </p>
      <InvitationForm />

      <section className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="th">Pour</th>
              <th className="th">État</th>
              <th className="th">Lien</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {invitations?.length === 0 && (
              <tr>
                <td className="td text-slate-500" colSpan={4}>
                  Aucune invitation.
                </td>
              </tr>
            )}
            {invitations?.map((i) => {
              const expired = !i.used_at && new Date(i.expires_at).getTime() <= now;
              return (
                <tr key={i.id}>
                  <td className="td">
                    {i.note ?? '—'}
                    <div className="text-xs text-slate-500">créée le {dateTime(i.created_at)}</div>
                  </td>
                  <td className="td">
                    {i.used_at ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Utilisée par {i.used_email}
                        <div className="text-xs text-slate-500">{dateTime(i.used_at)}</div>
                      </span>
                    ) : expired ? (
                      <span className="text-slate-500">Expirée</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">
                        En attente
                        <div className="text-xs text-slate-500">
                          jusqu’au {dateTime(i.expires_at)}
                        </div>
                      </span>
                    )}
                  </td>
                  <td className="td min-w-72">
                    {!i.used_at && !expired && <CopyLink url={`${origin}/signup?code=${i.code}`} />}
                  </td>
                  <td className="td text-right">
                    {!i.used_at && (
                      <form action={revokeInvitation.bind(null, i.id)}>
                        <button className="text-sm text-red-600 underline">
                          {expired ? 'Supprimer' : 'Révoquer'}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../login/actions';

const links = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/orders', label: 'Ordres' },
  { href: '/alerts', label: 'Alertes' },
  { href: '/history', label: 'Historique' },
  { href: '/settings', label: 'Réglages' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  const nav = isAdmin
    ? [
        ...links,
        { href: '/invitations', label: 'Comptes' },
        { href: '/supervision', label: 'Supervision' },
      ]
    : links;
  return (
    <div className="mx-auto max-w-6xl pb-16">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-phosphor px-4 py-2 font-semibold text-tube">
        <span>BOURSE.SYS</span>
        <nav className="flex flex-1 flex-wrap gap-x-5 gap-y-1 text-sm">
          {nav.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-tube hover:bg-tube hover:text-phosphor"
            >
              [F{i + 1}] {l.label.toLowerCase()}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button className="text-sm text-tube hover:bg-tube hover:text-phosphor">
            [esc] déconnexion
          </button>
        </form>
      </header>
      <main className="px-4 pt-6">{children}</main>
    </div>
  );
}

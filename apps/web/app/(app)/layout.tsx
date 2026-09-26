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
  const nav = isAdmin ? [...links, { href: '/invitations', label: 'Invitations' }] : links;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
        <span className="font-semibold">Bourse Tracker</span>
        <nav className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
          {nav.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button className="text-sm text-slate-500 hover:underline">Déconnexion</button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  );
}

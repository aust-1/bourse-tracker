import Link from 'next/link';
import { PortfolioSwitcher } from '@/components/portfolio-switcher';
import { portfolioScope } from '@/lib/portfolios';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../login/actions';

const links = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/orders', label: 'Ordres' },
  { href: '/alerts', label: 'Alertes' },
  { href: '/history', label: 'Historique' },
  { href: '/cash', label: 'Mouvements' },
  { href: '/portfolios', label: 'Portefeuilles' },
  { href: '/settings', label: 'Réglages' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [{ data: isAdmin }, scope] = await Promise.all([
    supabase.rpc('is_admin'),
    portfolioScope(supabase).catch(() => ({ portfolios: [], selected: null })),
  ]);
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
        <nav className="order-last flex basis-full flex-wrap gap-x-4 gap-y-1 text-sm sm:order-none sm:flex-1 sm:basis-auto sm:gap-x-5">
          {nav.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-tube hover:bg-tube hover:text-phosphor"
            >
              <span className="hidden sm:inline">[F{i + 1}] </span>
              {l.label.toLowerCase()}
            </Link>
          ))}
        </nav>
        <PortfolioSwitcher
          portfolios={scope.portfolios.map((p) => ({ id: p.id, name: p.name }))}
          selected={scope.selected?.id ?? null}
        />
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

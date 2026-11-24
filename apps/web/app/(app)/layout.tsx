import Link from 'next/link';
import { MainNav } from '@/components/main-nav';
import { PortfolioSwitcher } from '@/components/portfolio-switcher';
import { pageTitle } from '@/lib/page-title';
import { portfolioScope } from '@/lib/portfolios';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../login/actions';

// onglet du navigateur sur le tableau de bord (chaque section pose le sien)
export const metadata = pageTitle('Tableau de bord');

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
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-phosphor px-4 py-2 font-semibold text-tube">
        {/* nom du site : police d'affichage, séparé des onglets par un trait */}
        <Link
          href="/"
          className="border-r-2 border-tube pr-4 font-display text-3xl leading-none tracking-wider text-tube hover:text-tube"
        >
          BOURSE.SYS
        </Link>
        <MainNav links={nav} />
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

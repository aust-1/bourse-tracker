'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActiveTab } from '@/lib/nav';

/** Onglets du menu : l'onglet de la page affichée est en négatif (aria-current="page"). */
export function MainNav({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Menu principal"
      className="order-last flex basis-full flex-wrap gap-x-1 gap-y-1 text-sm font-normal sm:order-none sm:flex-1 sm:basis-auto"
    >
      {links.map((l, i) => {
        const active = isActiveTab(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'bg-tube px-1.5 text-phosphor hover:text-phosphor'
                : 'px-1.5 text-tube hover:bg-tube hover:text-phosphor'
            }
          >
            <span className="hidden sm:inline">[F{i + 1}] </span>
            {l.label.toLowerCase()}
          </Link>
        );
      })}
    </nav>
  );
}

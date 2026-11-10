'use client';

import { useRef } from 'react';
import { selectPortfolio } from '@/app/(app)/portfolios/actions';

/** Sélecteur du portefeuille affiché (masqué s'il n'y en a qu'un). */
export function PortfolioSwitcher({
  portfolios,
  selected,
}: {
  portfolios: { id: string; name: string }[];
  selected: string | null;
}) {
  const form = useRef<HTMLFormElement>(null);
  if (portfolios.length < 2) return null;
  return (
    <form ref={form} action={selectPortfolio}>
      <label className="sr-only" htmlFor="portfolio-switcher">
        Portefeuille affiché
      </label>
      <select
        id="portfolio-switcher"
        name="portfolio"
        defaultValue={selected ?? 'all'}
        onChange={() => form.current?.requestSubmit()}
        className="bg-tube px-1 text-sm text-phosphor"
      >
        <option value="all">Tous les portefeuilles</option>
        {portfolios.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </form>
  );
}

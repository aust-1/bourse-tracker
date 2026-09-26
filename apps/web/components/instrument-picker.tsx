'use client';

import { useEffect, useState } from 'react';
import type { SearchHit } from '@bourse/providers';

interface Props {
  defaultSymbol?: string;
  defaultLabel?: string;
  locked?: boolean;
}

export function InstrumentPicker({ defaultSymbol = '', defaultLabel = '', locked = false }: Props) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [query, setQuery] = useState(defaultLabel);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (locked || !open || query.trim().length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/instruments/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const json = (await res.json()) as { hits: SearchHit[] };
        setHits(json.hits);
      } catch {
        // requête annulée ou réseau : on garde la liste précédente
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, open, locked]);

  return (
    <div className="relative">
      <input type="hidden" name="symbol" value={symbol} />
      <input
        className="input"
        placeholder="Rechercher un titre ou un ETF (nom, symbole)…"
        value={query}
        readOnly={locked}
        onChange={(e) => {
          setQuery(e.target.value);
          setSymbol('');
          setOpen(true);
        }}
        aria-label="Instrument"
        autoComplete="off"
      />
      {symbol && <p className="mt-1 text-xs text-slate-500">Symbole : {symbol}</p>}
      {open && !locked && query.trim().length >= 2 && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow dark:border-slate-700 dark:bg-slate-900">
          {searching && <li className="px-3 py-2 text-sm text-slate-500">Recherche…</li>}
          {!searching && hits.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">Aucun résultat</li>
          )}
          {hits.map((h) => (
            <li key={h.symbol}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  setSymbol(h.symbol);
                  setQuery(`${h.name} (${h.symbol})`);
                  setOpen(false);
                }}
              >
                <span className="truncate">{h.name}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {h.symbol} · {h.exchangeName} · {h.type}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { SearchHit } from '@bourse/providers';
import { asYahooSymbol, readSearchResponse, SEARCH_UNAVAILABLE } from '@/lib/instrument-search';

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
  // panne de la source ou session expirée : distinct d'une recherche sans résultat
  const [failure, setFailure] = useState<string | null>(null);
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
        const body: unknown = await res.json().catch(() => null);
        const outcome = readSearchResponse({
          ok: res.ok,
          redirected: res.redirected,
          url: res.url,
          body,
        });
        if (outcome.kind === 'hits') {
          setHits(outcome.hits);
          setFailure(null);
        } else {
          setHits([]);
          setFailure(outcome.message);
        }
      } catch {
        // requête annulée : une nouvelle recherche a pris le relais
        if (ctrl.signal.aborted) return;
        // réseau coupé
        setHits([]);
        setFailure(SEARCH_UNAVAILABLE);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, open, locked]);

  const manualSymbol = asYahooSymbol(query);

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
          {!searching && failure && (
            <li className="px-3 py-2 text-sm">
              <p role="status" className="text-amber-700 dark:text-amber-400">
                {failure}
              </p>
              {manualSymbol && (
                <button
                  type="button"
                  className="mt-1 text-left underline"
                  onClick={() => {
                    setSymbol(manualSymbol);
                    setQuery(manualSymbol);
                    setOpen(false);
                  }}
                >
                  Utiliser « {manualSymbol} » comme symbole Yahoo
                </button>
              )}
            </li>
          )}
          {!searching && !failure && hits.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">
              <p role="status">Aucun résultat</p>
            </li>
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

'use client';

import { useActionState, useState } from 'react';
import { addMovement, type CashFormState } from '@/app/(app)/cash/actions';

const KINDS = [
  { value: 'deposit', label: 'Versement' },
  { value: 'withdrawal', label: 'Retrait' },
  { value: 'dividend', label: 'Dividende' },
  { value: 'fee', label: 'Frais (droits de garde…)' },
] as const;

export function CashForm({
  portfolios,
  instruments,
  defaultPortfolioId,
  today,
}: {
  portfolios: { id: string; name: string }[];
  instruments: { id: string; name: string; symbol: string }[];
  defaultPortfolioId: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<CashFormState, FormData>(addMovement, {});
  const v = state.values;
  const [kind, setKind] = useState(v?.kind ?? 'deposit');

  return (
    <form action={action} className="card flex max-w-2xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {portfolios.length > 1 ? (
          <label className="flex flex-col gap-1 text-sm">
            Portefeuille
            <select
              key={v?.portfolioId ?? defaultPortfolioId}
              name="portfolioId"
              defaultValue={v?.portfolioId ?? defaultPortfolioId}
              className="input"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="portfolioId" value={defaultPortfolioId} />
        )}
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="input"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Montant net (€)
          <input
            name="amount"
            inputMode="decimal"
            defaultValue={v?.amount ?? ''}
            required
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input
            type="date"
            name="occurredOn"
            defaultValue={v?.occurredOn ?? today}
            max={today}
            required
            className="input"
          />
        </label>
        {kind === 'dividend' && (
          <label className="flex flex-col gap-1 text-sm">
            Titre
            <select
              key={v?.instrumentId ?? ''}
              name="instrumentId"
              defaultValue={v?.instrumentId ?? ''}
              required
              className="input"
            >
              <option value="">—</option>
              {instruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.symbol})
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Note (optionnel)
          <input name="note" defaultValue={v?.note ?? ''} maxLength={200} className="input" />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <p role="status" className="text-sm">
          Mouvement enregistré.
        </p>
      )}
      <button disabled={pending} className="btn-primary w-fit">
        {pending ? 'Enregistrement…' : 'Ajouter le mouvement'}
      </button>
    </form>
  );
}

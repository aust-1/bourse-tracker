'use client';

import { useActionState } from 'react';
import { savePortfolio, type PortfolioFormState } from '@/app/(app)/portfolios/actions';
import { KIND_LABELS, type PortfolioKind } from '@/lib/portfolio-kinds';

export interface PortfolioFormValues {
  name: string;
  kind: PortfolioKind;
  openedOn: string;
}

export function PortfolioForm({ id, values }: { id: string | null; values: PortfolioFormValues }) {
  const [state, action, pending] = useActionState<PortfolioFormState, FormData>(
    savePortfolio.bind(null, id),
    {},
  );
  const v = state.values;
  return (
    <form action={action} className="card flex max-w-xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Nom
          <input
            name="name"
            defaultValue={v?.name ?? values.name}
            required
            maxLength={60}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Type
          <select
            key={v?.kind ?? values.kind}
            name="kind"
            defaultValue={v?.kind ?? values.kind}
            className="input"
          >
            {Object.entries(KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ouvert le
          <input
            type="date"
            name="openedOn"
            defaultValue={v?.openedOn ?? values.openedOn}
            className="input"
          />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="btn-primary w-fit">
        {pending ? 'Enregistrement…' : id ? 'Enregistrer' : 'Créer le portefeuille'}
      </button>
    </form>
  );
}

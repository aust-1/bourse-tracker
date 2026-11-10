'use client';

import { useActionState } from 'react';
import { saveOrder, type OrderFormState } from '@/app/(app)/orders/actions';
import { InstrumentPicker } from './instrument-picker';

export interface OrderFormValues {
  symbol: string;
  label: string;
  side: 'buy' | 'sell';
  quantity: string;
  unitPrice: string;
  fees: string;
  executedAt: string;
  note: string;
  portfolioId: string;
}

export function OrderForm({
  id,
  values,
  portfolios,
}: {
  id: string | null;
  values: OrderFormValues;
  portfolios: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<OrderFormState, FormData>(
    saveOrder.bind(null, id),
    {},
  );
  const v = state.values;
  return (
    <form action={action} className="card flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1 text-sm">
        Instrument
        <InstrumentPicker
          defaultSymbol={values.symbol}
          defaultLabel={values.label}
          locked={id !== null}
        />
      </div>

      {portfolios.length > 1 ? (
        <label className="flex flex-col gap-1 text-sm">
          Portefeuille
          <select
            // remonté après une erreur : un select ignore un nouveau defaultValue
            key={v?.portfolioId ?? values.portfolioId}
            name="portfolioId"
            defaultValue={v?.portfolioId ?? values.portfolioId}
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
        <input type="hidden" name="portfolioId" value={values.portfolioId} />
      )}

      <fieldset className="flex gap-6 text-sm">
        <legend className="mb-1">Sens</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="side"
            value="buy"
            defaultChecked={(v?.side ?? values.side) === 'buy'}
          />{' '}
          Achat
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="side"
            value="sell"
            defaultChecked={(v?.side ?? values.side) === 'sell'}
          />{' '}
          Vente
        </label>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          Quantité
          <input
            name="quantity"
            inputMode="decimal"
            defaultValue={v?.quantity ?? values.quantity}
            required
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Prix unitaire (€)
          <input
            name="unitPrice"
            inputMode="decimal"
            defaultValue={v?.unitPrice ?? values.unitPrice}
            required
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Frais (€)
          <input
            name="fees"
            inputMode="decimal"
            defaultValue={v?.fees ?? values.fees}
            className="input"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Date et heure d&apos;exécution (heure de Paris)
        <input
          type="datetime-local"
          name="executedAt"
          defaultValue={v?.executedAt ?? values.executedAt}
          required
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Note (optionnel)
        <input name="note" defaultValue={v?.note ?? values.note} className="input" />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <div className="flex gap-3">
        <button disabled={pending} className="btn-primary">
          {pending ? 'Enregistrement…' : id ? 'Enregistrer' : "Ajouter l'ordre"}
        </button>
      </div>
    </form>
  );
}

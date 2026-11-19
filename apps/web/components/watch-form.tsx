'use client';

import { useActionState } from 'react';
import { addToWatchlist, type WatchFormState } from '@/app/(app)/watchlist/actions';
import { InstrumentPicker } from './instrument-picker';

export function WatchForm() {
  const [state, action, pending] = useActionState<WatchFormState, FormData>(addToWatchlist, {});
  return (
    <form action={action} className="card flex max-w-2xl flex-col gap-3">
      {/* clé : le champ se vide après un ajout */}
      <InstrumentPicker key={state.added ?? 0} />
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="btn-primary w-fit">
        {pending ? 'Ajout…' : 'Suivre ce titre'}
      </button>
    </form>
  );
}

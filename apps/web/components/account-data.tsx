'use client';

import { useActionState } from 'react';
import { DELETE_CONFIRMATION } from '@/lib/account';
import { deleteAccount, type DeleteState } from '@/app/(app)/settings/account-actions';

/** Export de ses données et suppression de son compte. */
export function AccountData() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});
  return (
    <section className="card flex max-w-xl flex-col gap-4">
      <h2 className="text-lg font-semibold">Mes données</h2>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Toutes tes données (ordres, alertes, historique des alertes, réglages) dans un fichier
          JSON.
        </p>
        <a href="/settings/export" className="btn-secondary w-fit">
          Exporter mes données
        </a>
      </div>
      <form
        action={action}
        className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800"
      >
        <p className="text-sm text-red-600">
          Supprimer le compte efface définitivement tous tes ordres, alertes et réglages.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          Tape {DELETE_CONFIRMATION} pour confirmer
          <input name="confirm" autoComplete="off" required className="input w-48" />
        </label>
        {state.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <button disabled={pending} className="btn-secondary w-fit text-red-600">
          {pending ? 'Suppression…' : 'Supprimer mon compte'}
        </button>
      </form>
    </section>
  );
}

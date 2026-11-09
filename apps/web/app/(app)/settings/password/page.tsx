'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { MIN_PASSWORD } from '@/lib/signup';
import { changePassword, type PasswordState } from './actions';

export default function PasswordPage() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Mot de passe</h1>
      {state.done ? (
        <p role="status" className="text-sm">
          Mot de passe changé. <Link href="/">Retour au tableau de bord</Link>
        </p>
      ) : (
        <form action={action} className="card flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Nouveau mot de passe
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              required
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Confirmation
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              required
              className="input"
            />
          </label>
          {state.error && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
          <button disabled={pending} className="btn-primary w-fit">
            {pending ? 'Enregistrement…' : 'Changer le mot de passe'}
          </button>
        </form>
      )}
    </div>
  );
}

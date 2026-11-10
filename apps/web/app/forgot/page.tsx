'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestReset, type ForgotState } from './actions';

export default function ForgotPage() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestReset, {});
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1>
        BOURSE TRACKER
        <span className="ml-2 inline-block h-9 w-4 translate-y-1 bg-phosphor" aria-hidden />
      </h1>
      {state.sent ? (
        <p role="status" className="text-sm">
          Si un compte existe pour cette adresse, un lien pour choisir un nouveau mot de passe vient
          d’y être envoyé. Ouvre-le dans ce navigateur.
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Indique l’adresse de ton compte : tu recevras un lien pour choisir un nouveau mot de
            passe.
          </p>
          <input
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            required
            className="input"
          />
          {state.error && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
          <button disabled={pending} className="btn-primary">
            {pending ? 'Envoi…' : 'Recevoir un lien'}
          </button>
        </form>
      )}
      <Link href="/login" className="text-sm underline">
        Retour à la connexion
      </Link>
    </main>
  );
}

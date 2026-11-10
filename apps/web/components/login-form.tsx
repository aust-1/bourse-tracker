'use client';

import { useActionState } from 'react';
import { signIn, type FormState } from '@/app/login/actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        required
        className="input"
      />
      <input
        name="password"
        type="password"
        placeholder="Mot de passe"
        autoComplete="current-password"
        required
        className="input"
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="btn-primary">
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}

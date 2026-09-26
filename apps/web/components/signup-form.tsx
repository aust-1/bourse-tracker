'use client';

import { useActionState } from 'react';
import { signUp, type SignUpState } from '@/app/signup/actions';
import { MIN_PASSWORD } from '@/lib/signup';

export function SignUpForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<SignUpState, FormData>(
    signUp.bind(null, code),
    {},
  );
  if (state.message) {
    return (
      <p role="status" className="text-sm">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        defaultValue={state.email}
        required
        className="input"
      />
      <input
        name="password"
        type="password"
        placeholder={`Mot de passe (${MIN_PASSWORD} caractères minimum)`}
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        required
        className="input"
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="btn-primary">
        {pending ? 'Création…' : 'Créer mon compte'}
      </button>
    </form>
  );
}

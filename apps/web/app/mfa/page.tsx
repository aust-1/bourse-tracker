'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useTransition } from 'react';
import { safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/browser';
import { signOut } from '../login/actions';

function MfaForm() {
  const next = safeNext(useSearchParams().get('next'));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (formData: FormData) =>
    start(async () => {
      setError(null);
      const code = String(formData.get('code') ?? '').replace(/\s/g, '');
      const supabase = createClient();
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find((f) => f.status === 'verified');
      if (listError || !factor) {
        setError('Aucun second facteur trouvé : reconnecte-toi.');
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code,
      });
      if (verifyError) {
        setError('Code incorrect ou expiré.');
        return;
      }
      // rechargement complet : le serveur relit la session (désormais aal2) depuis les cookies
      window.location.assign(next);
    });

  return (
    <form action={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Code à 6 chiffres de ton application d’authentification
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          required
          autoFocus
          className="input tracking-widest"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button disabled={pending} className="btn-primary">
        {pending ? 'Vérification…' : 'Valider'}
      </button>
    </form>
  );
}

export default function MfaPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1>
        BOURSE TRACKER
        <span className="ml-2 inline-block h-9 w-4 translate-y-1 bg-phosphor" aria-hidden />
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Double authentification activée sur ce compte.
      </p>
      <Suspense>
        <MfaForm />
      </Suspense>
      <form action={signOut}>
        <button className="text-sm underline">Annuler et se déconnecter</button>
      </form>
    </main>
  );
}

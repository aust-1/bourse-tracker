'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/browser';

type State =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'enrolling'; factorId: string; qrCode: string; secret: string }
  | { kind: 'on'; factorId: string };

/** Activation / désactivation de la double authentification (TOTP). */
export function MfaSettings() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const { data } = await createClient().auth.mfa.listFactors();
    const verified = data?.totp.find((f) => f.status === 'verified');
    setState(verified ? { kind: 'on', factorId: verified.id } : { kind: 'off' });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enroll = () =>
    start(async () => {
      setMessage(null);
      const supabase = createClient();
      // un enrôlement abandonné laisse un facteur non vérifié : on le retire d'abord
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) {
        if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Bourse Tracker ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error || !data) {
        setMessage({ error: true, text: 'Activation impossible pour le moment.' });
        return;
      }
      setState({
        kind: 'enrolling',
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    });

  const verify = (formData: FormData) =>
    start(async () => {
      if (state.kind !== 'enrolling') return;
      const code = String(formData.get('code') ?? '').replace(/\s/g, '');
      const { error } = await createClient().auth.mfa.challengeAndVerify({
        factorId: state.factorId,
        code,
      });
      if (error) {
        setMessage({ error: true, text: 'Code incorrect : vérifie l’heure de ton téléphone.' });
        return;
      }
      setMessage({ error: false, text: 'Double authentification activée.' });
      setState({ kind: 'on', factorId: state.factorId });
    });

  const disable = () =>
    start(async () => {
      if (state.kind !== 'on') return;
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: state.factorId });
      if (error) {
        setMessage({ error: true, text: 'Désactivation impossible pour le moment.' });
        return;
      }
      await supabase.auth.refreshSession();
      setMessage({ error: false, text: 'Double authentification désactivée.' });
      setState({ kind: 'off' });
    });

  return (
    <section className="card flex max-w-xl flex-col gap-3">
      <h2 className="text-lg font-semibold">Double authentification</h2>
      {state.kind === 'loading' && <p className="text-sm text-slate-500">Chargement…</p>}
      {state.kind === 'off' && (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Désactivée. Une fois activée, un code à 6 chiffres (Google Authenticator, 1Password,
            Aegis…) sera demandé à chaque connexion.
          </p>
          <button type="button" disabled={pending} onClick={enroll} className="btn-secondary w-fit">
            Activer
          </button>
        </>
      )}
      {state.kind === 'enrolling' && (
        <>
          <p className="text-sm">
            Scanne ce QR code avec ton application, puis saisis le code affiché.
          </p>
          <img
            src={state.qrCode}
            alt="QR code de la double authentification"
            width={180}
            height={180}
            className="bg-white p-2"
          />
          <p className="text-xs text-slate-500">
            Ou saisis la clé à la main : <code data-testid="totp-secret">{state.secret}</code>
          </p>
          <form action={verify} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Code
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                required
                className="input w-40 tracking-widest"
              />
            </label>
            <button disabled={pending} className="btn-primary">
              Confirmer
            </button>
          </form>
        </>
      )}
      {state.kind === 'on' && (
        <>
          <p className="text-sm">Activée : un code est demandé à chaque connexion.</p>
          <button
            type="button"
            disabled={pending}
            onClick={disable}
            className="btn-secondary w-fit"
          >
            Désactiver
          </button>
        </>
      )}
      {message && (
        <p
          role={message.error ? 'alert' : 'status'}
          className={`text-sm ${message.error ? 'text-red-600' : ''}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}

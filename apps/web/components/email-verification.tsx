'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  confirmEmailCode,
  requestEmailCode,
  type EmailCodeState,
} from '@/app/(app)/settings/actions';

/**
 * Confirmation de l'adresse des notifications : tant qu'elle n'est pas confirmée (code reçu à
 * cette adresse), aucun email ne lui est envoyé. L'adresse du compte l'est d'office.
 */
export function EmailVerification({
  email,
  verified,
  codeSent,
}: {
  email: string;
  verified: boolean;
  /** Un code a été demandé ou envoyé et n'a pas expiré */
  codeSent: boolean;
}) {
  const [request, setRequest] = useState<EmailCodeState>({});
  const [requesting, startRequest] = useTransition();
  const [confirm, confirmAction, confirming] = useActionState(confirmEmailCode, {});

  if (verified || confirm.verified) {
    return (
      <section className="card text-sm" aria-label="Confirmation de l’adresse email">
        <p className="text-emerald-700 dark:text-emerald-400">
          ✔ {email} : adresse confirmée, elle reçoit les notifications par email.
        </p>
      </section>
    );
  }

  return (
    <section
      className="card flex max-w-2xl flex-col gap-3 text-sm"
      aria-label="Confirmation de l’adresse email"
    >
      <h2 className="text-sm font-medium">Confirmer l’adresse email</h2>
      <p className="text-amber-700 dark:text-amber-400">
        {email} n’est pas encore confirmée : aucune alerte, aucun résumé ni test ne lui est envoyé.
      </p>
      <div>
        <button
          type="button"
          className="btn-secondary"
          disabled={requesting}
          onClick={() => startRequest(async () => setRequest(await requestEmailCode()))}
        >
          {requesting ? 'Demande…' : 'Recevoir un code de confirmation'}
        </button>
      </div>
      {request.message && <p role="status">{request.message}</p>}
      {request.error && (
        <p role="alert" className="text-red-600">
          {request.error}
        </p>
      )}
      {(codeSent || request.requested || confirm.requested) && (
        <form action={confirmAction} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            Code reçu
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              className="input w-32"
            />
          </label>
          <button className="btn-primary" disabled={confirming}>
            Confirmer
          </button>
        </form>
      )}
      {confirm.error && (
        <p role="alert" className="text-red-600">
          {confirm.error}
        </p>
      )}
    </section>
  );
}

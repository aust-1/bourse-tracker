'use client';

import { useActionState, useState } from 'react';
import { createInvitation, type InvitationState } from '@/app/(app)/invitations/actions';

export function InvitationForm() {
  const [state, action, pending] = useActionState<InvitationState, FormData>(createInvitation, {});
  return (
    <form action={action} className="card flex flex-wrap items-end gap-3">
      <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm">
        Pour qui ? (facultatif)
        <input name="note" maxLength={100} placeholder="ex. Camille" className="input" />
      </label>
      <button disabled={pending} className="btn-primary">
        {pending ? 'Création…' : 'Créer un lien d’invitation'}
      </button>
      {state.error && (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={url} className="input font-mono text-xs" aria-label="Lien" />
      <button
        type="button"
        className="btn-secondary shrink-0"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
  );
}

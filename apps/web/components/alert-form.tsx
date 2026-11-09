'use client';

import { isPortfolioAlert, type AlertType } from '@bourse/core';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { createAlert, type AlertFormState } from '@/app/(app)/alerts/actions';
import { ALERT_TYPES, alertTypeInfo, REARM_CHOICES } from '@/lib/alerts';
import { InstrumentPicker } from './instrument-picker';

export interface ChannelStatus {
  discord: boolean;
  email: boolean;
}

export function AlertForm({
  defaultSymbol = '',
  defaultLabel = '',
  configured,
}: {
  defaultSymbol?: string;
  defaultLabel?: string;
  configured: ChannelStatus;
}) {
  const [state, action, pending] = useActionState<AlertFormState, FormData>(createAlert, {});
  const [type, setType] = useState<AlertType>('price_above');
  const unit = alertTypeInfo(type).unit === 'eur' ? '€' : '%';
  // après une erreur, on restitue les canaux cochés ; sinon tous cochés par défaut
  const wants = (c: string) =>
    state.values ? state.values.channels?.split(',').includes(c) : true;
  const nothingConfigured = !configured.discord && !configured.email;

  return (
    <form action={action} className="card flex max-w-xl flex-col gap-4">
      {!isPortfolioAlert(type) && (
        <div className="flex flex-col gap-1 text-sm">
          Instrument
          <InstrumentPicker defaultSymbol={defaultSymbol} defaultLabel={defaultLabel} />
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Condition
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as AlertType)}
          className="input"
        >
          {ALERT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Seuil ({unit})
        <input
          name="magnitude"
          inputMode="decimal"
          defaultValue={state.values?.magnitude}
          required
          className="input"
        />
        {type === 'drawdown_from_high' && (
          <span className="text-xs text-slate-500">
            Le plus haut est suivi à partir de la création de l’alerte (cours de séance).
          </span>
        )}
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor="alert-rearm">Réarmer automatiquement</label>
        <select
          id="alert-rearm"
          name="rearm"
          key={state.values?.rearm ?? ''}
          defaultValue={state.values?.rearm ?? ''}
          aria-describedby="alert-rearm-hint"
          className="input"
        >
          {REARM_CHOICES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <span id="alert-rearm-hint" className="text-xs text-slate-500">
          Une fois le délai écoulé, l’alerte se réarme dès que la condition n’est plus remplie.
        </span>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Note (rappelée dans la notification)
        <input
          name="note"
          defaultValue={state.values?.note}
          maxLength={200}
          placeholder="ex. renforcer si < 80 €"
          className="input"
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">Me prévenir par</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="channels"
            value="discord"
            defaultChecked={wants('discord')}
          />{' '}
          Discord
          {!configured.discord && <span className="text-xs text-amber-600">(non configuré)</span>}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="channels" value="email" defaultChecked={wants('email')} />{' '}
          Email
          {!configured.email && <span className="text-xs text-amber-600">(non configuré)</span>}
        </label>
        {nothingConfigured && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Aucun canal n&apos;est configuré : l&apos;alerte sera consignée dans l&apos;historique
            sans notification.{' '}
            <Link href="/settings" className="underline">
              Configurer
            </Link>
          </p>
        )}
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <div>
        <button disabled={pending} className="btn-primary">
          {pending ? 'Création…' : "Créer l'alerte"}
        </button>
      </div>
    </form>
  );
}

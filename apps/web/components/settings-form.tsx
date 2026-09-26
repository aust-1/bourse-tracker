'use client';

import { useActionState, useState, useTransition } from 'react';
import { saveSettings, sendTest, type SettingsState } from '@/app/(app)/settings/actions';
import { SUMMARY_MAX, SUMMARY_MIN } from '@/lib/settings';

export interface SettingsValues {
  discordWebhookUrl: string;
  email: string;
  summaryEnabled: boolean;
  summaryTime: string;
}

function TestButton({ channel, label }: { channel: 'discord' | 'email'; label: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className="btn-secondary w-fit"
        onClick={() =>
          start(async () => {
            setResult((await sendTest(channel)).message);
          })
        }
      >
        {pending ? 'Envoi…' : label}
      </button>
      {result && (
        <p role="status" className="text-xs text-slate-600 dark:text-slate-400">
          {result}
        </p>
      )}
    </div>
  );
}

export function SettingsForm({ values }: { values: SettingsValues }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const v = state.values;
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <form action={action} className="card flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Webhook Discord
          <input
            name="discordWebhookUrl"
            type="url"
            defaultValue={v?.discordWebhookUrl ?? values.discordWebhookUrl}
            placeholder="https://discord.com/api/webhooks/…"
            className="input"
          />
          <span className="text-xs text-slate-500">
            Discord → Paramètres du salon → Intégrations → Webhooks → Copier l&apos;URL.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Adresse email
          <input
            name="email"
            type="email"
            defaultValue={v?.email ?? values.email}
            placeholder="toi@exemple.fr"
            className="input"
          />
        </label>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">Résumé quotidien</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="summaryEnabled"
              defaultChecked={v ? v.summaryEnabled === 'on' : values.summaryEnabled}
            />
            Recevoir un résumé du portefeuille chaque jour de bourse
          </label>
          <label className="flex items-center gap-2">
            À partir de
            <input
              type="time"
              name="summaryTime"
              defaultValue={v?.summaryTime ?? values.summaryTime}
              min={SUMMARY_MIN}
              max={SUMMARY_MAX}
              required
              className="input w-auto"
            />
            <span className="text-xs text-slate-500">
              (entre {SUMMARY_MIN} et {SUMMARY_MAX}, heure de Paris)
            </span>
          </label>
        </fieldset>

        {state.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {state.message}
          </p>
        )}
        <div>
          <button disabled={pending} className="btn-primary">
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>

      <section className="card flex flex-col gap-3">
        <h2 className="text-sm font-medium">Tester les notifications</h2>
        <p className="text-xs text-slate-500">
          Le test utilise les réglages enregistrés : enregistre avant de tester.
        </p>
        <TestButton channel="discord" label="Envoyer un test Discord" />
        <TestButton channel="email" label="Envoyer un test email" />
      </section>
    </div>
  );
}

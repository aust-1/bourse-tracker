'use client';

import { useActionState, useState, useTransition } from 'react';
import { saveSettings, sendTest, type SettingsState } from '@/app/(app)/settings/actions';
import type { Channel } from '@bourse/providers';
import { BENCHMARK_SUGGESTIONS } from '@/lib/benchmark-suggestions';
import { SUMMARY_MAX, SUMMARY_MIN } from '@/lib/settings';

export interface SettingsValues {
  discordWebhookUrl: string;
  email: string;
  summaryEnabled: boolean;
  summaryTime: string;
  socialTaxRate: string;
  incomeTaxRate: string;
  benchmarkSymbol: string;
  reportFrequency: string;
  ntfyUrl: string;
  telegramChatId: string;
}

function TestButton({ channel, label }: { channel: Channel; label: string }) {
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

export function SettingsForm({
  values,
  telegramAvailable = false,
}: {
  values: SettingsValues;
  telegramAvailable?: boolean;
}) {
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

        <label className="flex flex-col gap-1 text-sm">
          Sujet ntfy (notifications sur le téléphone)
          <input
            name="ntfyUrl"
            type="url"
            defaultValue={v?.ntfyUrl ?? values.ntfyUrl}
            placeholder="https://ntfy.sh/un-nom-difficile-a-deviner"
            className="input"
          />
          <span className="text-xs text-slate-500">
            Installe l’application ntfy et abonne-toi à ce sujet. Quiconque connaît le nom lit les
            messages : choisis-le long et aléatoire.
          </span>
        </label>

        {telegramAvailable && (
          <label className="flex flex-col gap-1 text-sm">
            Identifiant Telegram
            <input
              name="telegramChatId"
              inputMode="numeric"
              defaultValue={v?.telegramChatId ?? values.telegramChatId}
              placeholder="123456789"
              className="input"
            />
            <span className="text-xs text-slate-500">
              Écris d’abord au robot de l’instance, puis demande ton identifiant à @userinfobot.
            </span>
          </label>
        )}

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
          <label className="flex items-center gap-2">
            Rapport périodique
            <select
              name="reportFrequency"
              key={v?.reportFrequency ?? values.reportFrequency}
              defaultValue={v?.reportFrequency ?? values.reportFrequency}
              className="input w-auto"
            >
              <option value="">Aucun</option>
              <option value="weekly">Chaque semaine</option>
              <option value="monthly">Chaque mois</option>
            </select>
          </label>
          <span className="text-xs text-slate-500">
            Envoyé le dernier jour de bourse de la semaine ou du mois, à l’heure du résumé : gain
            hors apports, rendement, meilleure et pire ligne, alertes.
          </span>
        </fieldset>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">Fiscalité du PEA (estimations)</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              Prélèvements sociaux
              <input
                name="socialTaxRate"
                inputMode="decimal"
                defaultValue={v?.socialTaxRate ?? values.socialTaxRate}
                className="input w-20"
              />
              %
            </label>
            <label className="flex items-center gap-2">
              Impôt sur le revenu (avant 5 ans)
              <input
                name="incomeTaxRate"
                inputMode="decimal"
                defaultValue={v?.incomeTaxRate ?? values.incomeTaxRate}
                className="input w-20"
              />
              %
            </label>
          </div>
          <span className="text-xs text-slate-500">
            Taux appliqués à la plus-value en cas de retrait ; vérifie-les après chaque loi de
            finances.
          </span>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          Indice de référence (page Historique)
          <input
            name="benchmarkSymbol"
            list="benchmark-suggestions"
            defaultValue={v?.benchmarkSymbol ?? values.benchmarkSymbol}
            placeholder="^FCHI"
            className="input w-48"
          />
          <datalist id="benchmark-suggestions">
            {BENCHMARK_SUGGESTIONS.map((b) => (
              <option key={b.symbol} value={b.symbol}>
                {b.label}
              </option>
            ))}
          </datalist>
          <span className="text-xs text-slate-500">
            Symbole Yahoo : ^FCHI (CAC 40), ^STOXX50E, CW8.PA (MSCI World)… Vide : pas de
            comparaison.
          </span>
        </label>

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
        <TestButton channel="ntfy" label="Envoyer un test ntfy" />
        {telegramAvailable && <TestButton channel="telegram" label="Envoyer un test Telegram" />}
      </section>
    </div>
  );
}

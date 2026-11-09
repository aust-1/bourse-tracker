'use client';

import { useActionState } from 'react';
import {
  confirmImport,
  previewImport,
  type ImportState,
  type PreviewLine,
} from '@/app/(app)/orders/import/actions';
import { dateTime, eur, num } from '@/lib/format';

const STATUS: Record<PreviewLine['status'], string> = {
  ok: 'À importer',
  new_instrument: 'À importer',
  duplicate: 'Doublon',
  error: 'Erreur',
};

export function ImportForm({
  portfolios,
  defaultPortfolioId,
}: {
  portfolios: { id: string; name: string }[];
  defaultPortfolioId: string;
}) {
  const [preview, previewAction, previewing] = useActionState<ImportState, FormData>(
    previewImport,
    {},
  );
  const [result, confirmAction, importing] = useActionState<ImportState, FormData>(
    confirmImport,
    {},
  );
  const lines = preview.lines ?? [];

  return (
    <div className="flex flex-col gap-4">
      <form action={previewAction} className="card flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Fichier CSV
          <input type="file" name="file" accept=".csv,text/csv,text/plain" className="text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          ou colle son contenu
          <textarea name="csv" rows={6} className="input font-mono text-xs" spellCheck={false} />
        </label>
        {portfolios.length > 1 ? (
          <label className="flex flex-col gap-1 text-sm">
            Portefeuille (lignes sans colonne « portefeuille »)
            <select name="portfolioId" defaultValue={defaultPortfolioId} className="input w-auto">
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="portfolioId" value={defaultPortfolioId} />
        )}
        <p className="text-xs text-slate-500">
          Colonnes reconnues : date, symbole (Yahoo) ou ISIN, sens (achat / vente), quantité, prix,
          frais, note, portefeuille. Le format de l’export de l’application est accepté tel quel.
        </p>
        {preview.error && (
          <p role="alert" className="text-sm text-red-600">
            {preview.error}
          </p>
        )}
        <button disabled={previewing} className="btn-secondary w-fit">
          {previewing ? 'Lecture…' : 'Aperçu'}
        </button>
      </form>

      {lines.length > 0 && (
        <>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm" aria-label="Aperçu de l’import">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="th">Ligne</th>
                  <th className="th">État</th>
                  <th className="th">Date</th>
                  <th className="th">Titre</th>
                  <th className="th">Sens</th>
                  <th className="th text-right">Qté</th>
                  <th className="th text-right">Prix</th>
                  <th className="th text-right">Frais</th>
                  <th className="th">Portefeuille</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lines.map((l) => (
                  <tr key={l.line}>
                    <td className="td tabular-nums">{l.line}</td>
                    <td className="td">
                      <span
                        className={
                          l.status === 'error'
                            ? 'text-red-600'
                            : l.status === 'duplicate'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {STATUS[l.status]}
                      </span>
                      {l.message && <div className="text-xs text-slate-500">{l.message}</div>}
                    </td>
                    <td className="td whitespace-nowrap">{l.date ? dateTime(l.date) : ''}</td>
                    <td className="td">{l.label}</td>
                    <td className="td">{l.side ? (l.side === 'buy' ? 'Achat' : 'Vente') : ''}</td>
                    <td className="td text-right tabular-nums">
                      {l.quantity !== undefined ? num(l.quantity) : ''}
                    </td>
                    <td className="td text-right tabular-nums">
                      {l.unitPrice !== undefined ? eur(l.unitPrice) : ''}
                    </td>
                    <td className="td text-right tabular-nums">
                      {l.fees !== undefined ? eur(l.fees) : ''}
                    </td>
                    <td className="td">{l.portfolio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={confirmAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="payload" value={preview.payload ?? '[]'} />
            <button disabled={importing || !preview.count} className="btn-primary">
              {importing
                ? 'Import…'
                : `Importer ${preview.count ?? 0} ordre${(preview.count ?? 0) > 1 ? 's' : ''}`}
            </button>
            <span className="text-xs text-slate-500">
              Les lignes en erreur et les doublons sont ignorés. Tout ou rien : si un ordre est
              refusé (vente à découvert…), aucun n’est ajouté.
            </span>
          </form>
          {result.error && (
            <p role="alert" className="text-sm text-red-600">
              {result.error}
            </p>
          )}
        </>
      )}
    </div>
  );
}

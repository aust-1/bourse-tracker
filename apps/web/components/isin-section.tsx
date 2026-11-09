import { peaEligibility } from '@bourse/core';
import { saveIsin } from '@/app/(app)/instruments/[id]/actions';

/** ISIN du titre et indice d'éligibilité au PEA. */
export function IsinSection({
  instrumentId,
  isin,
  canEdit,
}: {
  instrumentId: string;
  isin: string | null;
  canEdit: boolean;
}) {
  const eligibility = peaEligibility(isin);
  return (
    <section className="card flex flex-col gap-2 text-sm" aria-label="Identification">
      <h2 className="text-sm font-medium">Identification</h2>
      <p>
        ISIN : <span className="font-mono">{isin ?? '—'}</span>
      </p>
      <p data-testid="pea-eligibility">
        {eligibility === 'outside_eea' && (
          <span className="text-red-600">
            ⚠ Émetteur hors de l’EEE : titre non éligible au PEA.
          </span>
        )}
        {eligibility === 'eea' && (
          <span className="text-emerald-600 dark:text-emerald-400">
            Émetteur de l’EEE : éligible au PEA en principe (un ETF doit investir au moins 75 % en
            actions européennes, à vérifier auprès du courtier).
          </span>
        )}
        {eligibility === 'unknown' && (
          <span className="text-slate-500">
            ISIN inconnu : renseigne-le pour vérifier l’éligibilité au PEA.
          </span>
        )}
      </p>
      {canEdit && (
        <form action={saveIsin.bind(null, instrumentId)} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            {isin ? 'Corriger l’ISIN' : 'Renseigner l’ISIN'}
            <input
              name="isin"
              defaultValue={isin ?? ''}
              placeholder="FR0000120271"
              maxLength={14}
              required
              className="input w-44 font-mono uppercase"
            />
          </label>
          <button className="btn-secondary">Enregistrer</button>
        </form>
      )}
    </section>
  );
}

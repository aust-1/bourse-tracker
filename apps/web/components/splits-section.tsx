import { addSplit, deleteSplit } from '@/app/(app)/instruments/[id]/actions';

interface SplitRow {
  id: string;
  effective_on: string;
  ratio_from: number;
  ratio_to: number;
}

const frDate = (d: string) => d.split('-').reverse().join('/');

/** Divisions / regroupements du titre ; saisie réservée à l'administrateur. */
export function SplitsSection({
  instrumentId,
  splits,
  isAdmin,
}: {
  instrumentId: string;
  splits: SplitRow[];
  isAdmin: boolean;
}) {
  if (splits.length === 0 && !isAdmin) return null;
  return (
    <section className="card flex flex-col gap-3" aria-label="Divisions">
      <h2 className="text-sm font-medium">Divisions et regroupements</h2>
      {splits.length > 0 ? (
        <ul className="text-sm">
          {splits.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-1">
              <span>
                Le {frDate(s.effective_on)} : {s.ratio_from} ancien
                {s.ratio_from > 1 ? 's' : ''} → {s.ratio_to} nouveau
                {s.ratio_to > 1 ? 'x' : ''}
              </span>
              {isAdmin && (
                <form action={deleteSplit.bind(null, instrumentId, s.id)}>
                  <button className="text-sm text-red-600 underline">Supprimer</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Aucune.</p>
      )}
      {splits.length > 0 && (
        <p className="text-xs text-slate-500">
          Les ordres antérieurs sont convertis en titres d’après la division pour la position, le
          PRU et les courbes (les cours de Yahoo sont ajustés de la même façon).
        </p>
      )}
      {isAdmin && (
        <form
          action={addSplit.bind(null, instrumentId)}
          className="flex flex-wrap items-end gap-3 text-sm"
        >
          <label className="flex flex-col gap-1">
            Date d’effet
            <input type="date" name="effectiveOn" required className="input" />
          </label>
          <label className="flex flex-col gap-1">
            Anciens titres
            <input
              name="from"
              type="number"
              min={1}
              step={1}
              defaultValue={1}
              required
              className="input w-24"
            />
          </label>
          <label className="flex flex-col gap-1">
            Nouveaux titres
            <input name="to" type="number" min={1} step={1} required className="input w-24" />
          </label>
          <button className="btn-secondary">Ajouter la division</button>
        </form>
      )}
    </section>
  );
}

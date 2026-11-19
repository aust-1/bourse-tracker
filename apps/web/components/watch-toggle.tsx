import { setWatched } from '@/app/(app)/watchlist/actions';
import { createClient } from '@/lib/supabase/server';

/** Bouton « Suivre » de la fiche d'un titre : liste de suivi (cours et historique sans ordre). */
export async function WatchToggle({ instrumentId }: { instrumentId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_instruments')
    .select('watched')
    .eq('instrument_id', instrumentId)
    .maybeSingle();
  if (!data) return null;
  return (
    <form action={setWatched.bind(null, instrumentId, !data.watched)}>
      <button className="btn-secondary !px-3 !py-1 text-sm">
        {data.watched ? '★ Suivi (retirer de la liste)' : '☆ Suivre ce titre'}
      </button>
    </form>
  );
}

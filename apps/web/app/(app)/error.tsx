'use client'; // les limites d'erreur sont des composants client

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Erreur d'une page (panne passagère de Supabase, donnée incohérente…) : l'en-tête et le menu
 * restent affichés, la page peut être rechargée sans quitter le site.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="card flex max-w-xl flex-col gap-3">
      <h1>Erreur</h1>
      <p>
        Cette page n’a pas pu être chargée. Le service de données est peut-être momentanément
        indisponible : réessaie dans un instant.
      </p>
      {error.digest && <p className="text-xs text-slate-500">Référence : {error.digest}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={() => retry()}>
          Réessayer
        </button>
        <Link href="/" className="btn-secondary">
          Tableau de bord
        </Link>
      </div>
    </div>
  );
}

'use client'; // les limites d'erreur sont des composants client

import { useEffect } from 'react';
import './globals.css';

/**
 * Erreur du layout racine : remplace tout le document (ni menu ni polices du site), d'où les
 * balises <html> et <body>. Les métadonnées n'y sont pas prises en charge : <title> direct.
 */
export default function GlobalError({
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
    <html lang="fr">
      <body>
        <title>Erreur · Bourse Tracker</title>
        <main
          role="alert"
          className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4"
        >
          <h1>ERREUR</h1>
          <p>Le site n’a pas pu s’afficher. Réessaie dans un instant.</p>
          {error.digest && <p className="text-xs text-slate-500">Référence : {error.digest}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => retry()}>
              Réessayer
            </button>
            {/* lien classique : recharge entièrement le document */}
            <a href="/" className="btn-secondary">
              Accueil
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

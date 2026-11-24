import Link from 'next/link';

/** 404 hors de l'espace connecté (adresse inconnue). */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1>
        ERREUR 404
        <span className="ml-2 inline-block h-9 w-4 translate-y-1 bg-phosphor" aria-hidden />
      </h1>
      <p>Cette page n’existe pas.</p>
      <div>
        <Link href="/" className="btn-secondary">
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}

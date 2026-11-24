import Link from 'next/link';

/** Page ou titre introuvable (titre inconnu ou non suivi…), dans le cadre du site. */
export default function AppNotFound() {
  return (
    <div className="card flex max-w-xl flex-col gap-3">
      <h1>Introuvable</h1>
      <p>Cette page n’existe pas, ou elle concerne un titre que tu ne suis pas.</p>
      <div>
        <Link href="/" className="btn-secondary">
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}

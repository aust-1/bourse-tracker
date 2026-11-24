/** Chargement d'une page serveur lourde, annoncé aux lecteurs d'écran (role="status"). */
export function PageLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <p className="text-sm text-slate-500">
        Chargement<span className="animate-pulse">…</span>
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-20 animate-pulse" />
        ))}
      </div>
      <div className="card h-48 animate-pulse" aria-hidden />
    </div>
  );
}

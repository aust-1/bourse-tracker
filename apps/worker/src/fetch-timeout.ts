/** Délai maximal d'une requête du worker vers Supabase. */
export const SUPABASE_TIMEOUT_MS = 20_000;

/**
 * `fetch` borné dans le temps, pour le client Supabase du worker : une requête sans réponse fait
 * échouer le cycle au lieu de bloquer la boucle indéfiniment. Le signal de l'appelant reste
 * respecté.
 */
export function fetchWithTimeout(timeoutMs: number, base: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return base(input, { ...init, signal });
  };
}

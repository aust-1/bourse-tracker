interface Page<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Lit toutes les lignes d'une requête. PostgREST plafonne chaque réponse (1 000 lignes par
 * défaut) et tronque silencieusement : sans pagination, un portefeuille de plus de 1 000 ordres
 * verrait les plus récents (ou les plus anciens) ignorés, faussant PRU et valeur.
 *
 * `page(from, to)` doit porter un `.order(...)` déterministe (ex. par id) : sans tri stable,
 * des lignes peuvent être lues deux fois ou manquées entre deux pages.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) return out;
  }
}

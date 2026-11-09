import type { CloseRow } from './history';

/** Petit cache LRU en mémoire (un processus Next.js) : les plus anciennes entrées sortent. */
export class Lru<V> {
  private readonly map = new Map<string, V>();
  constructor(private readonly max: number) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      // remise en tête
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  set(key: string, value: V) {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }

  delete(key: string) {
    this.map.delete(key);
  }

  get size() {
    return this.map.size;
  }
}

const cache = new Lru<Promise<CloseRow[]>>(50);

/**
 * Clôtures des instruments, gardées tant que la version des données de marché ne change pas
 * (incrémentée par la base à chaque écriture dans price_history ou splits). Les clôtures sont
 * communes à tous les comptes ; les identifiants demandés viennent des ordres lus sous RLS.
 * Sans version lisible, on relit la base.
 */
export async function cachedCloses(
  ids: readonly string[],
  version: number | null,
  load: (ids: readonly string[]) => Promise<CloseRow[]>,
  store: Lru<Promise<CloseRow[]>> = cache,
): Promise<CloseRow[]> {
  if (ids.length === 0) return [];
  if (version === null) return load(ids);
  const key = `${version}:${[...ids].sort().join(',')}`;
  const hit = store.get(key);
  if (hit) return hit;
  const pending = load(ids);
  store.set(key, pending);
  // un échec de lecture ne reste pas en cache
  pending.catch(() => store.delete(key));
  return pending;
}

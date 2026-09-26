import { describe, expect, it } from 'vitest';
import { fetchAll } from './paginate';

/** Simule PostgREST : renvoie au plus `cap` lignes par appel. */
const source = (total: number, cap = 1000) => {
  const rows = Array.from({ length: total }, (_, i) => i);
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, Math.min(to + 1, from + cap)), error: null };
  };
  return { page, calls };
};

describe('fetchAll', () => {
  it('lit tout au-delà du plafond de 1 000 lignes', async () => {
    const { page, calls } = source(2500);
    const all = await fetchAll(page);
    expect(all).toHaveLength(2500);
    expect(all[0]).toBe(0);
    expect(all[2499]).toBe(2499);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('un total qui tombe pile sur un multiple de la page : une page vide finale', async () => {
    const { page, calls } = source(2000);
    expect(await fetchAll(page)).toHaveLength(2000);
    expect(calls).toHaveLength(3);
  });

  it("moins qu'une page : un seul appel", async () => {
    const { page, calls } = source(10);
    expect(await fetchAll(page)).toHaveLength(10);
    expect(calls).toHaveLength(1);
  });

  it('aucune ligne', async () => {
    expect(await fetchAll(source(0).page)).toEqual([]);
  });

  it('propage les erreurs', async () => {
    await expect(
      fetchAll(async () => ({ data: null, error: { message: 'boom' } })),
    ).rejects.toThrow('boom');
  });
});

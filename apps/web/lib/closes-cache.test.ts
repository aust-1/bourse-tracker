import { describe, expect, it, vi } from 'vitest';
import { cachedCloses, Lru } from './closes-cache';
import type { CloseRow } from './history';

const rows: CloseRow[] = [{ instrumentId: 'a', date: '2026-01-02', close: 10 }];

describe('Lru', () => {
  it('évince la plus ancienne entrée ; une lecture la remet en tête', () => {
    const l = new Lru<number>(2);
    l.set('a', 1);
    l.set('b', 2);
    l.get('a');
    l.set('c', 3);
    expect(l.get('b')).toBeUndefined();
    expect(l.get('a')).toBe(1);
    expect(l.size).toBe(2);
  });
});

describe('cachedCloses', () => {
  it('même version et mêmes titres : une seule lecture', async () => {
    const store = new Lru<Promise<CloseRow[]>>(10);
    const load = vi.fn(async () => rows);
    await cachedCloses(['b', 'a'], 7, load, store);
    expect(await cachedCloses(['a', 'b'], 7, load, store)).toBe(rows);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('nouvelle version : relecture', async () => {
    const store = new Lru<Promise<CloseRow[]>>(10);
    const load = vi.fn(async () => rows);
    await cachedCloses(['a'], 7, load, store);
    await cachedCloses(['a'], 8, load, store);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('version inconnue : pas de cache ; échec non conservé', async () => {
    const store = new Lru<Promise<CloseRow[]>>(10);
    const load = vi.fn(async () => rows);
    await cachedCloses(['a'], null, load, store);
    await cachedCloses(['a'], null, load, store);
    expect(load).toHaveBeenCalledTimes(2);

    const failing = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValue(rows);
    await expect(cachedCloses(['z'], 1, failing, store)).rejects.toThrow('réseau');
    await new Promise((r) => setTimeout(r, 0));
    expect(await cachedCloses(['z'], 1, failing, store)).toBe(rows);
  });

  it('aucun titre : aucune lecture', async () => {
    const load = vi.fn(async () => rows);
    expect(await cachedCloses([], 1, load)).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });
});

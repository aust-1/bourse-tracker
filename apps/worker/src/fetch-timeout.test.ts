import { describe, expect, it } from 'vitest';
import { fetchWithTimeout } from './fetch-timeout';

/** fetch simulé qui ne répond jamais, sauf interruption par le signal. */
const hanging: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
  });

describe('fetchWithTimeout', () => {
  it('une requête sans réponse échoue après le délai', async () => {
    const f = fetchWithTimeout(20, hanging);
    await expect(f('https://supabase.test/rest/v1/alerts')).rejects.toThrow();
  });

  it('le signal de l’appelant est respecté', async () => {
    const f = fetchWithTimeout(60_000, hanging);
    const ctrl = new AbortController();
    const pending = f('https://supabase.test/rest/v1/alerts', { signal: ctrl.signal });
    ctrl.abort(new Error('annulée'));
    await expect(pending).rejects.toThrow('annulée');
  });

  it('une réponse dans le délai passe telle quelle', async () => {
    const f = fetchWithTimeout(1000, async () => new Response('ok'));
    expect(await (await f('https://supabase.test/')).text()).toBe('ok');
  });
});

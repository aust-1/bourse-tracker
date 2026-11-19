import { describe, expect, it, vi } from 'vitest';
import { silentLogger } from './log';
import { createHeartbeat, interruptibleSleep, startScheduler } from './scheduler';

/** Fait tourner la boucle pendant `turns` tours (sleep instantané) puis l'arrête. */
async function run(now: Date, turns: number, cycle: () => Promise<void>) {
  let n = 0;
  const holder: { stop?: () => Promise<void> } = {};
  const sleep = async () => {
    await Promise.resolve();
    if (++n >= turns) void holder.stop?.();
  };
  const s = startScheduler({ intervalMs: 30_000, cycle, log: silentLogger, now: () => now, sleep });
  holder.stop = s.stop;
  await s.done;
}

describe('startScheduler', () => {
  it('en séance : un cycle à chaque tour', async () => {
    const cycle = vi.fn().mockResolvedValue(undefined);
    await run(new Date('2026-09-25T10:00:00Z'), 3, cycle);
    expect(cycle).toHaveBeenCalledTimes(3);
  });

  it('hors séance (week-end) : un seul cycle, au démarrage', async () => {
    const cycle = vi.fn().mockResolvedValue(undefined);
    await run(new Date('2026-09-26T10:00:00Z'), 3, cycle);
    expect(cycle).toHaveBeenCalledTimes(1);
  });

  it('une erreur de cycle ne tue pas la boucle', async () => {
    const cycle = vi.fn().mockRejectedValue(new Error('boom'));
    await run(new Date('2026-09-25T10:00:00Z'), 3, cycle);
    expect(cycle).toHaveBeenCalledTimes(3);
  });

  it("stop() interrompt la pause sans attendre l'intervalle", async () => {
    const cycle = vi.fn().mockResolvedValue(undefined);
    const s = startScheduler({
      intervalMs: 3_600_000,
      cycle,
      log: silentLogger,
      now: () => new Date('2026-09-25T10:00:00Z'),
    });
    await vi.waitFor(() => expect(cycle).toHaveBeenCalledTimes(1));
    const started = Date.now();
    await s.stop();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(cycle).toHaveBeenCalledTimes(1);
  });

  it("stop() pendant un cycle : le cycle se termine, aucun autre n'est lancé", async () => {
    let finish!: () => void;
    const cycle = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const s = startScheduler({
      intervalMs: 30_000,
      cycle,
      log: silentLogger,
      now: () => new Date('2026-09-25T10:00:00Z'),
    });
    await vi.waitFor(() => expect(cycle).toHaveBeenCalledTimes(1));
    let stopped = false;
    const stopping = s.stop().then(() => (stopped = true));
    await Promise.resolve();
    expect(stopped).toBe(false);
    finish();
    await stopping;
    expect(cycle).toHaveBeenCalledTimes(1);
  });

  it('onCycleDone : après chaque cycle réussi seulement', async () => {
    const onCycleDone = vi.fn();
    let n = 0;
    const cycle = vi.fn(async () => {
      if (++n === 2) throw new Error('boom');
    });
    const holder: { stop?: () => Promise<void> } = {};
    let turns = 0;
    const s = startScheduler({
      intervalMs: 30_000,
      cycle,
      log: silentLogger,
      now: () => new Date('2026-09-25T10:00:00Z'),
      onCycleDone,
      sleep: async () => {
        await Promise.resolve();
        if (++turns >= 3) void holder.stop?.();
      },
    });
    holder.stop = s.stop;
    await s.done;
    expect(cycle).toHaveBeenCalledTimes(3);
    expect(onCycleDone).toHaveBeenCalledTimes(2);
  });
});

describe('interruptibleSleep', () => {
  it("se termine dès l'interruption", async () => {
    const ctrl = new AbortController();
    const started = Date.now();
    const p = interruptibleSleep(60_000, ctrl.signal);
    ctrl.abort();
    await p;
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('createHeartbeat', () => {
  it('ping au plus une fois par période, seulement quand on l’appelle', async () => {
    const fetchMock = vi.fn(async () => new Response('OK'));
    vi.stubGlobal('fetch', fetchMock);
    try {
      let t = 0;
      const hb = createHeartbeat('https://hc-ping.com/x', silentLogger, 60_000, () => t);
      expect(fetchMock).not.toHaveBeenCalled();
      hb.beat();
      t = 30_000;
      hb.beat();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      t = 61_000;
      hb.beat();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('sans URL : rien', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    try {
      createHeartbeat(null, silentLogger).beat();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

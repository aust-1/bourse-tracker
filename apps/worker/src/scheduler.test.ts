import { describe, expect, it, vi } from 'vitest';
import { silentLogger } from './log';
import { startScheduler } from './scheduler';

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
});

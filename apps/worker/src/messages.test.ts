import { describe, expect, it, vi } from 'vitest';
import { alertMessage, describeCondition } from './messages';
import { SourceMonitor } from './monitor';

// Intl insère des espaces insécables dans les montants
const norm = (s: string) => s.replace(/\s+/g, ' ');

describe('messages', () => {
  it('décrit chaque condition', () => {
    expect(norm(describeCondition('price_above', 105))).toBe('cours ≥ 105,00 €');
    expect(norm(describeCondition('day_change_down', -5))).toContain('-5,00 %');
    expect(norm(describeCondition('position_pl_above', 20))).toContain('+20,00 %');
  });

  it("message d'alerte", () => {
    const m = alertMessage({
      type: 'price_below',
      threshold: 100,
      name: 'Amundi World',
      symbol: 'CW8.PA',
      price: 99.5,
      value: 99.5,
    });
    expect(norm(m.title)).toBe('🔔 Amundi World : cours ≤ 100,00 €');
    expect(norm(m.body)).toContain('CW8.PA cote 99,50 €');
  });
});

describe('SourceMonitor', () => {
  const t = (min: number) => new Date(Date.parse('2026-09-25T07:00:00Z') + min * 60_000); // séance
  const stale = 5 * 60_000;

  it('alerte une fois après le délai puis signale le rétablissement', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const m = new SourceMonitor(stale, t(0));
    await m.check(t(1), false, send);
    await m.check(t(4), false, send);
    expect(send).not.toHaveBeenCalled();
    await m.check(t(6), false, send);
    await m.check(t(7), false, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].title).toContain('indisponible');
    await m.check(t(8), true, send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0].title).toContain('rétablie');
  });

  it("hors séance : jamais d'alerte, et le compteur repart à l'ouverture", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const m = new SourceMonitor(stale, new Date('2026-09-24T20:00:00Z'));
    await m.check(new Date('2026-09-25T06:54:00Z'), false, send); // 08:54 Paris : hors fenêtre
    await m.check(new Date('2026-09-25T06:56:00Z'), false, send); // 08:56 Paris : 2 min après la reprise
    expect(send).not.toHaveBeenCalled();
    await m.check(new Date('2026-09-25T07:02:00Z'), false, send); // 8 min sans cote en séance
    expect(send).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it } from 'vitest';
import { evaluateAlert } from './alerts';

const ctx = { price: 105, prevClose: 100, avgCost: 90 };

describe('evaluateAlert', () => {
  it('seuil de prix', () => {
    expect(evaluateAlert({ type: 'price_above', threshold: 105 }, ctx).triggered).toBe(true);
    expect(evaluateAlert({ type: 'price_above', threshold: 105.01 }, ctx).triggered).toBe(false);
    expect(evaluateAlert({ type: 'price_below', threshold: 105 }, ctx).triggered).toBe(true);
    expect(evaluateAlert({ type: 'price_below', threshold: 104.99 }, ctx).triggered).toBe(false);
  });

  it('variation du jour, seuil signé', () => {
    const r = evaluateAlert({ type: 'day_change_up', threshold: 5 }, ctx);
    expect(r.triggered).toBe(true);
    expect(r.value).toBeCloseTo(5, 9);
    expect(evaluateAlert({ type: 'day_change_up', threshold: 6 }, ctx).triggered).toBe(false);
    const down = { ...ctx, price: 94 };
    expect(evaluateAlert({ type: 'day_change_down', threshold: -5 }, down).triggered).toBe(true);
    expect(evaluateAlert({ type: 'day_change_down', threshold: -7 }, down).triggered).toBe(false);
  });

  it('gain/perte de la position vs PRU', () => {
    const r = evaluateAlert({ type: 'position_pl_above', threshold: 15 }, ctx);
    expect(r.triggered).toBe(true);
    expect(r.value).toBeCloseTo((105 / 90 - 1) * 100, 9);
    expect(evaluateAlert({ type: 'position_pl_below', threshold: -10 }, ctx).triggered).toBe(false);
    expect(
      evaluateAlert({ type: 'position_pl_below', threshold: -10 }, { ...ctx, price: 80 }).triggered,
    ).toBe(true);
  });

  it('données manquantes : jamais déclenchée', () => {
    expect(
      evaluateAlert({ type: 'day_change_up', threshold: 1 }, { ...ctx, prevClose: null }),
    ).toEqual({
      triggered: false,
      value: null,
    });
    expect(
      evaluateAlert({ type: 'position_pl_above', threshold: 1 }, { ...ctx, avgCost: null })
        .triggered,
    ).toBe(false);
  });
});

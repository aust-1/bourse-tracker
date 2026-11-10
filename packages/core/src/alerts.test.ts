import { describe, expect, it } from 'vitest';
import { alertUnit, evaluateAlert, nextHigh, shouldRearm } from './alerts';

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

describe('nouvelles alertes', () => {
  it('baisse depuis le plus haut', () => {
    const r = evaluateAlert(
      { type: 'drawdown_from_high', threshold: -10 },
      { price: 90, high: 100 },
    );
    expect(r.triggered).toBe(true);
    expect(r.value).toBeCloseTo(-10, 9);
    expect(
      evaluateAlert({ type: 'drawdown_from_high', threshold: -10 }, { price: 91, high: 100 })
        .triggered,
    ).toBe(false);
    expect(evaluateAlert({ type: 'drawdown_from_high', threshold: -10 }, { price: 91 })).toEqual({
      triggered: false,
      value: null,
    });
  });

  it('portefeuille : valeur et variation du jour', () => {
    expect(
      evaluateAlert({ type: 'portfolio_value_below', threshold: 10_000 }, { portfolioValue: 9_999 })
        .triggered,
    ).toBe(true);
    expect(
      evaluateAlert({ type: 'portfolio_value_above', threshold: 10_000 }, { portfolioValue: 9_999 })
        .triggered,
    ).toBe(false);
    expect(
      evaluateAlert({ type: 'portfolio_day_change_down', threshold: -2 }, { portfolioDayPct: -2.5 })
        .triggered,
    ).toBe(true);
    expect(
      evaluateAlert({ type: 'portfolio_day_change_up', threshold: 2 }, { portfolioDayPct: 2 })
        .triggered,
    ).toBe(true);
  });

  it('unités', () => {
    expect(alertUnit('price_above')).toBe('eur');
    expect(alertUnit('portfolio_value_below')).toBe('eur');
    expect(alertUnit('drawdown_from_high')).toBe('pct');
    expect(alertUnit('portfolio_day_change_up')).toBe('pct');
  });

  it('plus haut de référence', () => {
    expect(nextHigh(null, 50)).toBe(50);
    expect(nextHigh(60, 50)).toBe(60);
    expect(nextHigh(60, 70)).toBe(70);
  });
});

describe('shouldRearm', () => {
  const now = new Date('2026-11-10T10:00:00Z');
  const a = { rearmMinutes: 60, lastTriggeredAt: '2026-11-10T08:30:00Z' };
  it('délai écoulé et condition redevenue fausse', () => {
    expect(shouldRearm(a, false, now)).toBe(true);
  });
  it('condition encore vraie : on attend', () => {
    expect(shouldRearm(a, true, now)).toBe(false);
  });
  it('délai non écoulé, ou pas de réarmement', () => {
    expect(shouldRearm({ ...a, lastTriggeredAt: '2026-11-10T09:30:00Z' }, false, now)).toBe(false);
    expect(shouldRearm({ ...a, rearmMinutes: null }, false, now)).toBe(false);
  });
});

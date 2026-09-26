import { describe, expect, it } from 'vitest';
import { parseAlertForm, toStoredThreshold } from './alerts';

const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
};

const valid = { symbol: 'CW8.PA', type: 'price_above', magnitude: '105,5', channels: ['discord'] };

describe('toStoredThreshold', () => {
  it('signe négatif pour les baisses et les pertes, positif sinon', () => {
    expect(toStoredThreshold('price_above', 100)).toBe(100);
    expect(toStoredThreshold('price_below', 100)).toBe(100);
    expect(toStoredThreshold('day_change_up', 5)).toBe(5);
    expect(toStoredThreshold('day_change_down', 5)).toBe(-5);
    expect(toStoredThreshold('position_pl_above', 20)).toBe(20);
    expect(toStoredThreshold('position_pl_below', 10)).toBe(-10);
  });
});

describe('parseAlertForm', () => {
  it('accepte une saisie valide (virgule décimale)', () => {
    expect(parseAlertForm(form(valid)).data).toEqual({
      symbol: 'CW8.PA',
      type: 'price_above',
      threshold: 105.5,
      channels: ['discord'],
    });
  });

  it('applique le signe selon le type', () => {
    const r = parseAlertForm(form({ ...valid, type: 'day_change_down', magnitude: '5' }));
    expect(r.data?.threshold).toBe(-5);
  });

  it('plusieurs canaux', () => {
    const r = parseAlertForm(form({ ...valid, channels: ['discord', 'email'] }));
    expect(r.data?.channels).toEqual(['discord', 'email']);
  });

  it.each([
    [{ symbol: '' }, /instrument/i],
    [{ type: 'nope' }, /Type/],
    [{ magnitude: '0' }, /Seuil/],
    [{ magnitude: '-3' }, /Seuil/],
    [{ magnitude: 'abc' }, /Seuil/],
    [{ channels: [] as string[] }, /canal/],
    [{ channels: ['sms'] }, /./],
  ])('rejette %j', (patch, msg) => {
    const r = parseAlertForm(form({ ...valid, ...patch }));
    expect(r.data).toBeUndefined();
    expect(r.error).toMatch(msg);
  });
});

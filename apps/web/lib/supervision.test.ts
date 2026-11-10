import { describe, expect, it } from 'vitest';
import { ago, quoteHealth, workerHealth } from './supervision';

const friday10h = new Date('2026-09-25T08:00:00Z'); // 10:00 Paris, séance
const saturday = new Date('2026-09-26T10:00:00Z');

describe('workerHealth', () => {
  it('inconnu sans cycle', () => expect(workerHealth(null, friday10h)).toBe('unknown'));
  it('ok sous 10 min', () => expect(workerHealth('2026-09-25T07:55:00Z', friday10h)).toBe('ok'));
  it('en retard au-delà', () =>
    expect(workerHealth('2026-09-25T07:45:00Z', friday10h)).toBe('late'));
});

describe('quoteHealth', () => {
  it('absente', () => expect(quoteHealth(null, friday10h)).toEqual({ kind: 'missing' }));
  it('en direct', () =>
    expect(quoteHealth('2026-09-25T07:59:30Z', friday10h)).toEqual({ kind: 'live' }));
  it('différée en séance', () =>
    expect(quoteHealth('2026-09-25T07:40:00Z', friday10h)).toEqual({
      kind: 'delayed',
      minutes: 20,
    }));
  it('marché fermé', () =>
    expect(quoteHealth('2026-09-25T15:30:00Z', saturday)).toEqual({ kind: 'closed' }));
});

describe('ago', () => {
  it.each([
    ['2026-09-25T07:59:15Z', '45 s'],
    ['2026-09-25T07:48:00Z', '12 min'],
    ['2026-09-25T05:00:00Z', '3 h'],
    ['2026-09-23T08:00:00Z', '2 j'],
  ])('%s → %s', (at, expected) => expect(ago(at, friday10h)).toBe(expected));
});

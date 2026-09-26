import { describe, expect, it } from 'vitest';
import {
  isMarketOpen,
  isPollingWindow,
  parisDate,
  parisDayStart,
  parisLocalToDate,
  parisMinutes,
  toParisLocal,
} from './market';

describe('market', () => {
  it('date et minutes à Paris (été, UTC+2)', () => {
    const d = new Date('2026-07-01T21:30:00Z'); // 23:30 à Paris
    expect(parisDate(d)).toBe('2026-07-01');
    expect(parisMinutes(d)).toBe(23 * 60 + 30);
    expect(parisDate(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02');
  });

  it('séance : ouverte 09:00-17:30 en semaine seulement', () => {
    expect(isMarketOpen(new Date('2026-09-25T07:00:00Z'))).toBe(true); // ven 09:00 Paris
    expect(isMarketOpen(new Date('2026-09-25T06:59:00Z'))).toBe(false);
    expect(isMarketOpen(new Date('2026-09-25T15:29:00Z'))).toBe(true); // 17:29
    expect(isMarketOpen(new Date('2026-09-25T15:30:00Z'))).toBe(false); // 17:30
    expect(isMarketOpen(new Date('2026-09-26T10:00:00Z'))).toBe(false); // samedi
  });

  it('polling : 08:55 à 17:40', () => {
    expect(isPollingWindow(new Date('2026-09-25T06:55:00Z'))).toBe(true);
    expect(isPollingWindow(new Date('2026-09-25T06:54:00Z'))).toBe(false);
    expect(isPollingWindow(new Date('2026-09-25T15:40:00Z'))).toBe(true);
    expect(isPollingWindow(new Date('2026-09-25T15:41:00Z'))).toBe(false);
  });

  it('début de journée parisienne, été et hiver', () => {
    expect(parisDayStart('2026-07-01').toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(parisDayStart('2026-01-15').toISOString()).toBe('2026-01-14T23:00:00.000Z');
  });

  it("début de journée les jours de changement d'heure", () => {
    expect(parisDayStart('2026-03-29').toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(parisDayStart('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z');
  });

  it('saisie locale Paris <-> UTC (été et hiver)', () => {
    expect(parisLocalToDate('2026-07-01T10:30').toISOString()).toBe('2026-07-01T08:30:00.000Z');
    expect(parisLocalToDate('2026-01-15T10:30').toISOString()).toBe('2026-01-15T09:30:00.000Z');
    expect(toParisLocal(new Date('2026-07-01T08:30:00Z'))).toBe('2026-07-01T10:30');
    expect(toParisLocal(parisLocalToDate('2026-10-25T09:15'))).toBe('2026-10-25T09:15');
  });

  it('saisie locale invalide -> erreur', () => {
    expect(() => parisLocalToDate('hier')).toThrow();
  });
});

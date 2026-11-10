import { describe, expect, it } from 'vitest';
import {
  isLastTradingDayOf,
  nextTradingDay,
  previousPeriodEnd,
  previousTradingDay,
  closeMinutes,
  easterSunday,
  euronextHolidays,
  isTradingDay,
  isMarketOpen,
  isPollingWindow,
  isWorkWindow,
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

  it('fenêtre de travail du worker : 08:55-23:00 en semaine', () => {
    expect(isWorkWindow(new Date('2026-09-25T06:55:00Z'))).toBe(true);
    expect(isWorkWindow(new Date('2026-09-25T17:00:00Z'))).toBe(true); // 19:00 Paris
    expect(isWorkWindow(new Date('2026-09-25T21:00:00Z'))).toBe(false); // 23:00 Paris
    expect(isWorkWindow(new Date('2026-09-25T06:54:00Z'))).toBe(false);
    expect(isWorkWindow(new Date('2026-09-26T10:00:00Z'))).toBe(false); // samedi
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

describe('jours fériés Euronext', () => {
  it.each([
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
  ])('Pâques %i = %s', (year, day) => {
    expect(easterSunday(year)).toBe(day);
  });

  it('liste 2026 : 1er janvier, Vendredi saint, lundi de Pâques, 1er mai, Noël, 26 décembre', () => {
    expect(euronextHolidays(2026)).toEqual([
      '2026-01-01',
      '2026-04-03',
      '2026-04-06',
      '2026-05-01',
      '2026-12-25',
      '2026-12-26',
    ]);
  });

  it.each([
    ['2026-04-03', false], // Vendredi saint
    ['2026-04-06', false], // lundi de Pâques
    ['2026-05-08', true], // 8 mai : férié en France mais Euronext ouvert
    ['2026-07-14', true], // 14 juillet : idem
    ['2026-09-26', false], // samedi
    ['2026-09-25', true],
  ])('%s jour de bourse : %s', (day, expected) => {
    expect(isTradingDay(day)).toBe(expected);
  });

  it('marché fermé un jour férié en semaine', () => {
    expect(isMarketOpen(new Date('2026-04-03T09:00:00Z'))).toBe(false); // 11:00 Paris
    expect(isPollingWindow(new Date('2026-04-03T09:00:00Z'))).toBe(false);
    expect(isWorkWindow(new Date('2026-12-25T17:00:00Z'))).toBe(false);
  });

  it('séance raccourcie le 24 décembre (clôture 14:05)', () => {
    expect(closeMinutes('2026-12-24')).toBe(14 * 60 + 5);
    expect(isMarketOpen(new Date('2026-12-24T13:00:00Z'))).toBe(true); // 14:00 Paris
    expect(isMarketOpen(new Date('2026-12-24T13:10:00Z'))).toBe(false); // 14:10 Paris
    expect(isPollingWindow(new Date('2026-12-24T13:20:00Z'))).toBe(false); // 14:20 Paris
    expect(closeMinutes('2026-12-23')).toBe(17 * 60 + 30);
  });
});

describe('fins de période', () => {
  it('jour de bourse suivant / précédent (week-end, Pâques)', () => {
    expect(nextTradingDay('2026-09-25')).toBe('2026-09-28');
    expect(nextTradingDay('2026-04-02')).toBe('2026-04-07'); // Vendredi saint + lundi de Pâques
    expect(previousTradingDay('2026-04-07')).toBe('2026-04-02');
  });

  it('dernier jour de bourse de la semaine', () => {
    expect(isLastTradingDayOf('weekly', '2026-09-25')).toBe(true); // vendredi
    expect(isLastTradingDayOf('weekly', '2026-09-24')).toBe(false);
    expect(isLastTradingDayOf('weekly', '2026-04-02')).toBe(true); // jeudi avant Vendredi saint
    expect(isLastTradingDayOf('weekly', '2026-09-26')).toBe(false); // samedi
  });

  it('dernier jour de bourse du mois', () => {
    expect(isLastTradingDayOf('monthly', '2026-10-30')).toBe(true); // vendredi 30, 31 = samedi
    expect(isLastTradingDayOf('monthly', '2026-10-29')).toBe(false);
    expect(isLastTradingDayOf('monthly', '2026-12-31')).toBe(true);
  });

  it('fin de la période précédente', () => {
    expect(previousPeriodEnd('weekly', '2026-09-25')).toBe('2026-09-18');
    expect(previousPeriodEnd('monthly', '2026-10-30')).toBe('2026-09-30');
  });
});

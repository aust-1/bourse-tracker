import { describe, expect, it } from 'vitest';
import { needsSecondFactor, routeAccess, safeNext } from './auth';

describe('safeNext', () => {
  it('garde un chemin local', () => {
    expect(safeNext('/settings/password')).toBe('/settings/password');
  });
  it('garde les paramètres et normalise le chemin', () => {
    expect(safeNext('/history?range=1y#top')).toBe('/history?range=1y#top');
    expect(safeNext('/a/../settings')).toBe('/settings');
  });
  it.each([
    null,
    undefined,
    '',
    'https://evil.example.com',
    '//evil.example.com',
    '/\\evil',
    // tabulations et sauts de ligne retirés par le navigateur : « //evil.example.com »
    '/\t/evil.example.com',
    '/\n/evil.example.com',
    '\t//evil.example.com',
    // la normalisation du chemin peut produire « //evil.example.com »
    '/.//evil.example.com',
    '/a/..//evil.example.com',
    '/./\\evil.example.com',
  ])('refuse %j', (v) => {
    expect(safeNext(v)).toBe('/');
  });
});

describe('needsSecondFactor', () => {
  it.each([
    [null, false],
    [{ currentLevel: 'aal1', nextLevel: 'aal1' }, false],
    [{ currentLevel: 'aal1', nextLevel: 'aal2' }, true],
    [{ currentLevel: 'aal2', nextLevel: 'aal2' }, false],
  ] as const)('%o → %s', (aal, expected) => {
    expect(needsSecondFactor(aal)).toBe(expected);
  });
});

describe('routeAccess', () => {
  it.each([
    ['/login', 'guest'],
    ['/signup', 'guest'],
    ['/forgot', 'guest'],
    ['/auth/confirm', 'open'],
    ['/manifest.webmanifest', 'open'],
    ['/', 'private'],
    ['/settings/password', 'private'],
    ['/loginx', 'private'],
  ] as const)('%s → %s', (path, access) => {
    expect(routeAccess(path)).toBe(access);
  });
});

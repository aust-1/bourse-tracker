import { describe, expect, it } from 'vitest';
import { needsSecondFactor, routeAccess, safeNext } from './auth';

describe('safeNext', () => {
  it('garde un chemin local', () => {
    expect(safeNext('/settings/password')).toBe('/settings/password');
  });
  it.each([null, undefined, '', 'https://evil.example.com', '//evil.example.com', '/\\evil'])(
    'refuse %s',
    (v) => {
      expect(safeNext(v)).toBe('/');
    },
  );
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

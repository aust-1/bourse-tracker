import { describe, expect, it } from 'vitest';
import { routeAccess, safeNext } from './auth';

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

describe('routeAccess', () => {
  it.each([
    ['/login', 'guest'],
    ['/signup', 'guest'],
    ['/forgot', 'guest'],
    ['/auth/confirm', 'open'],
    ['/', 'private'],
    ['/settings/password', 'private'],
    ['/loginx', 'private'],
  ] as const)('%s → %s', (path, access) => {
    expect(routeAccess(path)).toBe(access);
  });
});

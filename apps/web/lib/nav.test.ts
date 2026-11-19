import { describe, expect, it } from 'vitest';
import { isActiveTab } from './nav';

describe('isActiveTab', () => {
  it('tableau de bord : seulement la racine', () => {
    expect(isActiveTab('/', '/')).toBe(true);
    expect(isActiveTab('/orders', '/')).toBe(false);
  });
  it('page et sous-pages', () => {
    expect(isActiveTab('/orders', '/orders')).toBe(true);
    expect(isActiveTab('/orders/new', '/orders')).toBe(true);
    expect(isActiveTab('/settings/password', '/settings')).toBe(true);
  });
  it('préfixe sans séparateur : autre page', () => {
    expect(isActiveTab('/ordersx', '/orders')).toBe(false);
    expect(isActiveTab('/alerts', '/orders')).toBe(false);
  });
});

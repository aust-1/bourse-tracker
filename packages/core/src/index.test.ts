import { describe, expect, it } from 'vitest';
import { MARKET_TIMEZONE } from './index';

describe('core', () => {
  it('expose le fuseau des marchés', () => {
    expect(MARKET_TIMEZONE).toBe('Europe/Paris');
  });
});

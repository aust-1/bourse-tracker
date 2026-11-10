import { describe, expect, it } from 'vitest';
import { normalizeIsin, peaEligibility } from './isin';

describe('normalizeIsin', () => {
  it.each([
    ['US0378331005', 'US0378331005'], // Apple
    ['DE0007164600', 'DE0007164600'], // SAP
    ['FR0000120271', 'FR0000120271'], // TotalEnergies
    [' fr0000120271 ', 'FR0000120271'],
    ['LU1681043599', 'LU1681043599'], // Amundi MSCI World (CW8)
  ])('accepte %s', (input, expected) => {
    expect(normalizeIsin(input)).toBe(expected);
  });

  it.each(['US0378331006', 'FR000012027', 'XX', '1234567890AB', ''])('refuse %s', (input) => {
    expect(normalizeIsin(input)).toBeNull();
  });
});

describe('peaEligibility', () => {
  it.each([
    [null, 'unknown'],
    ['FR0000120271', 'eea'],
    ['IE00B4L5Y983', 'eea'],
    ['US0378331005', 'outside_eea'],
    ['CH0012005267', 'outside_eea'],
    ['GB00B03MLX29', 'outside_eea'],
  ] as const)('%s → %s', (isin, expected) => {
    expect(peaEligibility(isin)).toBe(expected);
  });
});

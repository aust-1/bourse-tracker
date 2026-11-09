/** Pays de l'Espace économique européen (UE + Islande, Liechtenstein, Norvège). */
export const EEA_COUNTRIES = new Set(
  (
    'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE ' + 'IS LI NO'
  ).split(' '),
);

const FORMAT = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/** ISIN normalisé (majuscules, sans espaces) ou null s'il est mal formé ou si la clé est fausse. */
export function normalizeIsin(input: string): string | null {
  const isin = input.replace(/\s/g, '').toUpperCase();
  if (!FORMAT.test(isin)) return null;
  // lettres → nombres (A = 10 … Z = 35), puis clé de Luhn sur la chaîne de chiffres
  const digits = isin
    .slice(0, 11)
    .split('')
    .map((c) => (c >= 'A' ? String(c.charCodeAt(0) - 55) : c))
    .join('');
  let sum = 0;
  for (let i = digits.length - 1, double = true; i >= 0; i--, double = !double) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(isin[11]) ? isin : null;
}

export type PeaEligibility = 'unknown' | 'eea' | 'outside_eea';

/**
 * Indice d'éligibilité au PEA tiré du pays de l'ISIN. Un émetteur hors EEE n'est pas éligible ;
 * dans l'EEE, l'éligibilité reste à confirmer (un ETF irlandais ou luxembourgeois ne l'est que
 * s'il investit au moins 75 % en actions européennes).
 */
export function peaEligibility(isin: string | null | undefined): PeaEligibility {
  if (!isin) return 'unknown';
  return EEA_COUNTRIES.has(isin.slice(0, 2)) ? 'eea' : 'outside_eea';
}

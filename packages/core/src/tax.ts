/** Ancienneté fiscale d'un PEA : avantages acquis après 5 ans. */
export const PEA_MATURITY_YEARS = 5;

export interface PeaTaxInput {
  /** Date d'ouverture YYYY-MM-DD (null : inconnue) */
  openedOn: string | null;
  /** Date du jour YYYY-MM-DD */
  today: string;
  /** Valeur liquidative : titres + liquidités */
  value: number;
  deposits: number;
  withdrawals: number;
  /** Prélèvements sociaux, en pourcents (17,2 = 17,2 %) */
  socialRate: number;
  /** Impôt sur le revenu (PFU), en pourcents */
  incomeRate: number;
}

export interface PeaTax {
  /** Date des 5 ans (null si date d'ouverture inconnue) */
  maturityOn: string | null;
  /** Ancienneté en années entières */
  ageYears: number | null;
  /** 5 ans atteints ; null si date d'ouverture inconnue */
  matured: boolean | null;
  /** Plus-value latente : valeur − (versements − retraits), jamais négative */
  gain: number;
  /** Taux appliqué (pourcents) : prélèvements sociaux, + IR avant 5 ans (ou si inconnu) */
  rate: number;
  /** Impôt estimé en cas de retrait total aujourd'hui */
  tax: number;
}

function addYears(day: string, years: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  // 29 février → 28 février les années non bissextiles
  const target = new Date(Date.UTC(y + years, m - 1, d));
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

function wholeYears(from: string, to: string): number {
  let n = Number(to.slice(0, 4)) - Number(from.slice(0, 4));
  if (to.slice(5) < from.slice(5)) n--;
  return Math.max(0, n);
}

/**
 * Estimation de l'impôt sur un retrait total du PEA aujourd'hui. Simplifiée : la plus-value est la
 * valeur moins les versements nets (les retraits passés sont retranchés au nominal).
 */
export function estimatePeaTax(i: PeaTaxInput): PeaTax {
  const maturityOn = i.openedOn ? addYears(i.openedOn, PEA_MATURITY_YEARS) : null;
  const matured = maturityOn ? i.today >= maturityOn : null;
  const gain = Math.max(0, i.value - (i.deposits - i.withdrawals));
  const rate = matured ? i.socialRate : i.socialRate + i.incomeRate;
  return {
    maturityOn,
    ageYears: i.openedOn ? wholeYears(i.openedOn, i.today) : null,
    matured,
    gain,
    rate,
    tax: (gain * rate) / 100,
  };
}

/** Point de la courbe : valeur et apports nets cumulés à une date (YYYY-MM-DD). */
export interface ValuePoint {
  date: string;
  marketValue: number;
  netContributions: number;
}

/**
 * Rendement pondéré par le temps (TWR), en pourcents : neutralise les apports et retraits, mesure
 * la seule performance des placements. Chaque jour est chaîné ; un apport compte en début de
 * journée (r = V / (V veille + apport)), un retrait en fin de journée (r = (V + retrait) / V veille).
 * `base` : point précédant la période (null : départ de zéro). null si rien n'est mesurable.
 */
export function twr(points: readonly ValuePoint[], base: ValuePoint | null = null): number | null {
  let prev = base ?? { date: '', marketValue: 0, netContributions: 0 };
  let growth = 1;
  let measured = false;
  for (const p of points) {
    const flow = p.netContributions - prev.netContributions;
    const r =
      flow >= 0
        ? prev.marketValue + flow > 0
          ? p.marketValue / (prev.marketValue + flow)
          : null
        : prev.marketValue > 0
          ? (p.marketValue - flow) / prev.marketValue
          : null;
    if (r !== null && Number.isFinite(r)) {
      growth *= r;
      measured = true;
    }
    prev = p;
  }
  return measured ? (growth - 1) * 100 : null;
}

export interface CashFlow {
  date: string;
  /** Du point de vue de l'investisseur : versement (−), retrait ou valeur finale (+) */
  amount: number;
}

const DAY_MS = 86_400_000;
const years = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS / 365;

/**
 * Taux de rendement interne annualisé (XIRR), en pourcents : le taux qui annule la valeur actuelle
 * des flux. Résolu par dichotomie (robuste, sans dérivée). null si les flux ne changent pas de
 * signe ou si aucune solution n'existe entre −99,99 % et +10 000 %.
 */
export function xirr(flows: readonly CashFlow[]): number | null {
  const fs = flows.filter((f) => f.amount !== 0);
  if (fs.length < 2) return null;
  if (!fs.some((f) => f.amount > 0) || !fs.some((f) => f.amount < 0)) return null;
  const t0 = fs.reduce((min, f) => (f.date < min ? f.date : min), fs[0]!.date);
  const npv = (rate: number) =>
    fs.reduce((s, f) => s + f.amount / Math.pow(1 + rate, years(t0, f.date)), 0);

  let lo = -0.9999;
  let hi = 100;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-9 || hi - lo < 1e-12) return mid * 100;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return ((lo + hi) / 2) * 100;
}

/**
 * Flux d'une période pour le XIRR : valeur de départ (comme un versement), apports et retraits
 * jour par jour, valeur finale (comme un retrait total).
 */
export function periodCashFlows(
  points: readonly ValuePoint[],
  base: ValuePoint | null = null,
): CashFlow[] {
  if (points.length === 0) return [];
  const flows: CashFlow[] = [];
  let prevContrib = 0;
  if (base) {
    flows.push({ date: base.date, amount: -base.marketValue });
    prevContrib = base.netContributions;
  }
  for (const p of points) {
    const flow = p.netContributions - prevContrib;
    if (flow !== 0) flows.push({ date: p.date, amount: -flow });
    prevContrib = p.netContributions;
  }
  const end = points[points.length - 1]!;
  flows.push({ date: end.date, amount: end.marketValue });
  return flows;
}

/**
 * Indice base 100 du TWR à chaque point (mêmes conventions que `twr`) : la courbe de performance
 * du portefeuille, hors effet des apports. Reste à 100 tant que rien n'est investi.
 */
export function twrIndex(points: readonly ValuePoint[], base: ValuePoint | null = null): number[] {
  let prev = base ?? { date: '', marketValue: 0, netContributions: 0 };
  let growth = 1;
  return points.map((p) => {
    const value = twr([p], prev);
    if (value !== null) growth *= 1 + value / 100;
    prev = p;
    return growth * 100;
  });
}

/**
 * Cours d'un indice ramenés en base 100 aux dates données : dernière clôture connue ≤ date,
 * divisée par celle de `baseDate` (ou de la première date). null tant qu'aucune clôture n'existe.
 */
export function rebaseCloses(
  closes: readonly { date: string; close: number }[],
  dates: readonly string[],
  baseDate: string | null = null,
): (number | null)[] {
  const sorted = [...closes].sort((a, b) => a.date.localeCompare(b.date));
  const at = (day: string): number | null => {
    let last: number | null = null;
    for (const c of sorted) {
      if (c.date > day) break;
      last = c.close;
    }
    return last;
  };
  const ref = at(baseDate ?? dates[0] ?? '') ?? sorted.find((c) => c.close > 0)?.close ?? null;
  if (!ref) return dates.map(() => null);
  return dates.map((d) => {
    const v = at(d);
    return v === null ? null : (v / ref) * 100;
  });
}

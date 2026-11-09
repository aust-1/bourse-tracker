export const MARKET_TIMEZONE = 'Europe/Paris';

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: MARKET_TIMEZONE,
  hourCycle: 'h23',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

interface Parts {
  weekday: string;
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
  s: number;
}

function parts(at: Date): Parts {
  const o: Record<string, string> = {};
  for (const p of fmt.formatToParts(at)) o[p.type] = p.value;
  return {
    weekday: o.weekday!,
    y: +o.year!,
    m: +o.month!,
    d: +o.day!,
    h: +o.hour!,
    min: +o.minute!,
    s: +o.second!,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Date calendaire à Paris, au format YYYY-MM-DD. */
export function parisDate(at: Date | string): string {
  const p = parts(new Date(at));
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Minutes écoulées depuis minuit à Paris. */
export function parisMinutes(at: Date | string): number {
  const p = parts(new Date(at));
  return p.h * 60 + p.min;
}

function offsetMinutes(at: Date): number {
  const p = parts(at);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** Instant (UTC) du minuit parisien qui ouvre le jour `date` (YYYY-MM-DD). */
export function parisDayStart(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d);
  let start = guess - offsetMinutes(new Date(guess)) * 60000;
  start = guess - offsetMinutes(new Date(start)) * 60000;
  return new Date(start);
}

const OPEN = 9 * 60;
const CLOSE = 17 * 60 + 30;
/** Séances raccourcies d'Euronext (24 et 31 décembre) : clôture à 14:05. */
const EARLY_CLOSE = 14 * 60 + 5;

/** Dimanche de Pâques (calendrier grégorien, algorithme de Meeus/Jones/Butcher), YYYY-MM-DD. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Jours fériés d'Euronext (Paris, Amsterdam, Bruxelles, Lisbonne, Milan, Dublin) : 1er janvier,
 * Vendredi saint, lundi de Pâques, 1er mai, 25 et 26 décembre.
 */
export function euronextHolidays(year: number): string[] {
  const easter = easterSunday(year);
  return [
    `${year}-01-01`,
    shiftDay(easter, -2),
    shiftDay(easter, 1),
    `${year}-05-01`,
    `${year}-12-25`,
    `${year}-12-26`,
  ];
}

const holidayCache = new Map<number, Set<string>>();

/** Jour de bourse : du lundi au vendredi, hors jours fériés d'Euronext. `day` = YYYY-MM-DD. */
export function isTradingDay(day: string): boolean {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const year = Number(day.slice(0, 4));
  let holidays = holidayCache.get(year);
  if (!holidays) {
    holidays = new Set(euronextHolidays(year));
    holidayCache.set(year, holidays);
  }
  return !holidays.has(day);
}

/** Heure de clôture (minutes depuis minuit, Paris) de la séance du jour `day`. */
export function closeMinutes(day: string): number {
  const md = day.slice(5);
  return md === '12-24' || md === '12-31' ? EARLY_CLOSE : CLOSE;
}

/** Séance continue Euronext : jours de bourse 09:00-17:30 Paris (14:05 les 24 et 31 décembre). */
export function isMarketOpen(at: Date): boolean {
  const day = parisDate(at);
  const m = parisMinutes(at);
  return isTradingDay(day) && m >= OPEN && m < closeMinutes(day);
}

/** Fenêtre de polling du worker : jours de bourse, de 08:55 à la clôture + 10 min (Paris). */
export function isPollingWindow(at: Date): boolean {
  const day = parisDate(at);
  const m = parisMinutes(at);
  return isTradingDay(day) && m >= OPEN - 5 && m <= closeMinutes(day) + 10;
}

/**
 * Fenêtre de travail du worker : jours de bourse 08:55-23:00 Paris. Les cotes ne sont récupérées
 * que dans la fenêtre de polling ; le reste sert au résumé du soir et à l'historique.
 */
export function isWorkWindow(at: Date): boolean {
  const m = parisMinutes(at);
  return isTradingDay(parisDate(at)) && m >= OPEN - 5 && m < 23 * 60;
}

/** Convertit une saisie `YYYY-MM-DDTHH:mm` (heure de Paris) en instant UTC. */
export function parisLocalToDate(local: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error(`Date invalide : ${local}`);
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  let at = asUtc - offsetMinutes(new Date(asUtc)) * 60000;
  at = asUtc - offsetMinutes(new Date(at)) * 60000;
  return new Date(at);
}

/** Inverse : instant → `YYYY-MM-DDTHH:mm` à Paris (valeur d'un input datetime-local). */
export function toParisLocal(at: Date | string): string {
  const p = parts(new Date(at));
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

/** Jour de bourse suivant `day` (YYYY-MM-DD). */
export function nextTradingDay(day: string): string {
  let d = shiftDay(day, 1);
  while (!isTradingDay(d)) d = shiftDay(d, 1);
  return d;
}

/** Jour de bourse précédant `day`. */
export function previousTradingDay(day: string): string {
  let d = shiftDay(day, -1);
  while (!isTradingDay(d)) d = shiftDay(d, -1);
  return d;
}

/** Lundi de la semaine de `day` (YYYY-MM-DD). */
function weekStart(day: string): string {
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftDay(day, -((wd + 6) % 7));
}

export type ReportPeriod = 'weekly' | 'monthly';

/** Vrai si `day` est le dernier jour de bourse de sa semaine (ou de son mois). */
export function isLastTradingDayOf(period: ReportPeriod, day: string): boolean {
  if (!isTradingDay(day)) return false;
  const next = nextTradingDay(day);
  return period === 'weekly'
    ? weekStart(next) !== weekStart(day)
    : next.slice(0, 7) !== day.slice(0, 7);
}

/** Dernier jour de bourse de la période précédente : base de comparaison d'un rapport. */
export function previousPeriodEnd(period: ReportPeriod, day: string): string {
  let d = previousTradingDay(day);
  const same = (a: string) =>
    period === 'weekly' ? weekStart(a) === weekStart(day) : a.slice(0, 7) === day.slice(0, 7);
  while (same(d)) d = previousTradingDay(d);
  return d;
}

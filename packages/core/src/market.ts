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

const isWeekday = (at: Date) => !['Sat', 'Sun'].includes(parts(at).weekday);

const OPEN = 9 * 60;
const CLOSE = 17 * 60 + 30;

/** Séance continue Euronext / Xetra : lun-ven 09:00-17:30 Paris (jours fériés non gérés). */
export function isMarketOpen(at: Date): boolean {
  const m = parisMinutes(at);
  return isWeekday(at) && m >= OPEN && m < CLOSE;
}

/** Fenêtre de polling du worker : lun-ven 08:55-17:40 Paris. */
export function isPollingWindow(at: Date): boolean {
  const m = parisMinutes(at);
  return isWeekday(at) && m >= OPEN - 5 && m <= CLOSE + 10;
}

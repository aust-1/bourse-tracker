import {
  buildSnapshots,
  describeCondition,
  fmtEur,
  fmtPct,
  isLastTradingDayOf,
  isWorkWindow,
  nextTradingDay,
  parisDate,
  parisDayStart,
  parisMinutes,
  previousPeriodEnd,
  twr,
  type Order,
  type ReportPeriod,
} from '@bourse/core';
import { allFailed, type Message, type Notifier } from '@bourse/providers';
import type { Logger } from './log';
import type { AlertEventRow, Store } from './store';
import { timeToMinutes } from './summary';

const signed = (n: number) => `${n > 0 ? '+' : ''}${fmtEur(n)}`;
const frDate = (d: string) => d.split('-').reverse().join('/');

export interface ReportInput {
  period: ReportPeriod;
  /** Dernier jour de bourse de la période précédente (base) */
  baseDay: string;
  /** Jour du rapport (dernier jour de bourse de la période) */
  day: string;
  orders: readonly (Order & { instrumentId: string })[];
  closes: readonly { instrumentId: string; date: string; close: number }[];
  /** Cours du jour (complète la clôture du jour si elle n'est pas encore enregistrée) */
  prices: ReadonlyMap<string, number>;
  names: ReadonlyMap<string, string>;
  income: readonly { date: string; amount: number }[];
  events: readonly AlertEventRow[];
}

export interface ReportFigures {
  startValue: number;
  endValue: number;
  /** Variation de valeur moins les apports de la période (revenus compris) */
  gain: number;
  contributions: number;
  income: number;
  twrPct: number | null;
  best: { name: string; pct: number } | null;
  worst: { name: string; pct: number } | null;
}

/** Chiffres d'un rapport : valeurs de début et fin, gain hors apports, TWR, lignes extrêmes. */
export function reportFigures(input: ReportInput): ReportFigures {
  const ids = [...new Set(input.orders.map((o) => o.instrumentId))];
  const closesOf = (id: string) => {
    const list = input.closes
      .filter((c) => c.instrumentId === id)
      .map((c) => ({ date: c.date, close: c.close }));
    const today = input.prices.get(id);
    if (today !== undefined && !list.some((c) => c.date === input.day)) {
      list.push({ date: input.day, close: today });
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  };
  const dates = [
    ...new Set([
      input.baseDay,
      ...input.closes.map((c) => c.date).filter((d) => d > input.baseDay && d <= input.day),
      input.day,
    ]),
  ].sort();
  const snaps = buildSnapshots(
    ids.map((id) => ({
      orders: input.orders.filter((o) => o.instrumentId === id),
      closes: closesOf(id),
    })),
    dates,
    input.income,
  );
  const base = snaps[0]!;
  const end = snaps[snaps.length - 1]!;
  const contributions = end.netContributions - base.netContributions;

  // performance de chaque ligne sur la période : dernier cours / clôture de base
  const lines = ids.flatMap((id) => {
    const list = closesOf(id);
    const start = [...list].reverse().find((c) => c.date <= input.baseDay)?.close;
    const last = list[list.length - 1]?.close;
    return start && last
      ? [{ name: input.names.get(id) ?? id, pct: (last / start - 1) * 100 }]
      : [];
  });
  lines.sort((a, b) => b.pct - a.pct);

  return {
    startValue: base.marketValue,
    endValue: end.marketValue,
    gain: end.marketValue - base.marketValue - contributions,
    contributions,
    income: end.income - base.income,
    twrPct: twr(snaps.slice(1), base),
    best: lines.length >= 2 ? lines[0]! : null,
    worst: lines.length >= 2 ? lines[lines.length - 1]! : null,
  };
}

export function reportMessage(input: ReportInput, f: ReportFigures): Message {
  const label = input.period === 'weekly' ? 'hebdomadaire' : 'mensuel';
  const lines = [
    `Du ${frDate(input.baseDay)} au ${frDate(input.day)}`,
    `Valeur : ${fmtEur(f.startValue)} → ${fmtEur(f.endValue)}`,
    `Gain hors apports : ${signed(f.gain)}${f.twrPct === null ? '' : ` (TWR ${fmtPct(f.twrPct)})`}`,
  ];
  if (f.contributions !== 0) lines.push(`Apports nets : ${signed(f.contributions)}`);
  if (f.income !== 0) lines.push(`Dividendes nets : ${signed(f.income)}`);
  if (f.best && f.worst) {
    lines.push(
      `Meilleure ligne : ${f.best.name} (${fmtPct(f.best.pct)})`,
      `Pire ligne : ${f.worst.name} (${fmtPct(f.worst.pct)})`,
    );
  }
  lines.push(
    input.events.length === 0
      ? 'Aucune alerte déclenchée sur la période.'
      : `Alertes déclenchées : ${input.events.length}`,
    ...input.events
      .slice(0, 10)
      .map((e) => `• ${e.instrumentName} : ${describeCondition(e.type, e.threshold)}`),
  );
  return { title: `🗓️ Rapport ${label}`, body: lines.join('\n'), level: 'info' };
}

interface Deps {
  store: Store;
  notifier: Pick<Notifier, 'notify'>;
  log: Logger;
  now?: Date;
}

/**
 * Rapport hebdomadaire ou mensuel : le dernier jour de bourse de la période, à partir de l'heure
 * du résumé quotidien, une seule fois. Retenté au cycle suivant si tous les canaux échouent.
 */
export async function sendPeriodicReports({
  store,
  notifier,
  log,
  now = new Date(),
}: Deps): Promise<{ sent: number }> {
  if (!isWorkWindow(now)) return { sent: 0 };
  const day = parisDate(now);
  const minutes = parisMinutes(now);
  let sent = 0;

  for (const s of await store.listSettings()) {
    const period = s.reportFrequency;
    if (!period || s.lastReportOn === day || minutes < timeToMinutes(s.summaryTime)) continue;
    if (!isLastTradingDayOf(period, day)) continue;
    try {
      const orders = await store.listUserOrders(s.userId);
      if (orders.length === 0) continue;
      const ids = [...new Set(orders.map((o) => o.instrumentId))];
      const quotes = await store.getQuotes(ids);
      if (![...quotes.values()].some((q) => parisDate(q.quotedAt) === day)) continue;

      const baseDay = previousPeriodEnd(period, day);
      const instruments = await store.listTrackedInstruments();
      const input: ReportInput = {
        period,
        baseDay,
        day,
        orders,
        // une clôture antérieure à la base sert de point de départ aux lignes sans séance ce jour-là
        closes: await store.getCloses(ids, previousPeriodEnd(period, baseDay)),
        prices: new Map([...quotes].map(([id, q]) => [id, q.price])),
        names: new Map(instruments.map((i) => [i.id, i.name])),
        income: await store.listIncome(s.userId),
        // alertes de la période : à partir de la séance qui suit la base
        events: await store.listAlertEventsSince(s.userId, parisDayStart(nextTradingDay(baseDay))),
      };
      const message = reportMessage(input, reportFigures(input));
      const delivery = await notifier.notify(s, ['discord', 'email'], message);
      if (allFailed(delivery)) {
        log.warn('rapport non envoyé, nouvelle tentative au prochain cycle', { delivery });
        continue;
      }
      await store.markReportSent(s.userId, day);
      sent++;
      log.info('rapport périodique envoyé', { period, delivery });
    } catch (e) {
      log.error('rapport périodique en échec', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { sent };
}

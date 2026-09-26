import {
  buildPortfolioView,
  describeCondition,
  fmtEur,
  fmtPct,
  parisDate,
  parisDayStart,
  parisMinutes,
  isWorkWindow,
  type PortfolioView,
} from '@bourse/core';
import { allFailed, type Message, type Notifier } from '@bourse/providers';
import type { Logger } from './log';
import type { AlertEventRow, Store } from './store';

const signed = (n: number) => `${n > 0 ? '+' : ''}${fmtEur(n)}`;

/** "17:45" ou "17:45:00" → minutes depuis minuit */
export function timeToMinutes(t: string): number {
  const [h = '0', m = '0'] = t.split(':');
  return Number(h) * 60 + Number(m);
}

export function summaryMessage(
  day: string,
  view: PortfolioView,
  events: readonly AlertEventRow[],
): Message {
  const { totals, rows } = view;
  const lines = [
    `Valeur : ${fmtEur(totals.marketValue)}`,
    `Variation du jour : ${signed(totals.dayPl)}${totals.dayPlPct === null ? '' : ` (${fmtPct(totals.dayPlPct)})`}`,
    `Gain latent : ${signed(totals.unrealizedPl)}${totals.unrealizedPlPct === null ? '' : ` (${fmtPct(totals.unrealizedPlPct)})`}`,
  ];

  const movers = rows
    .filter((r) => r.dayChangePct !== null)
    .sort((a, b) => b.dayChangePct! - a.dayChangePct!);
  if (movers.length >= 2) {
    const best = movers[0]!;
    const worst = movers[movers.length - 1]!;
    lines.push(
      `Meilleure ligne : ${best.name} (${fmtPct(best.dayChangePct!)})`,
      `Pire ligne : ${worst.name} (${fmtPct(worst.dayChangePct!)})`,
    );
  }

  if (totals.missingQuotes > 0) {
    lines.push(`⚠️ ${totals.missingQuotes} ligne(s) sans cotation, valorisée(s) à leur coût.`);
  }

  lines.push(
    events.length === 0
      ? 'Aucune alerte déclenchée aujourd’hui.'
      : `Alertes déclenchées aujourd’hui : ${events.length}`,
    ...events.map((e) => `• ${e.instrumentName} : ${describeCondition(e.type, e.threshold)}`),
  );

  const [y, m, d] = day.split('-');
  return { title: `📊 Résumé du ${d}/${m}/${y}`, body: lines.join('\n'), level: 'info' };
}

interface Deps {
  store: Store;
  notifier: Pick<Notifier, 'notify'>;
  log: Logger;
  now?: Date;
}

/**
 * Envoie le résumé du jour aux utilisateurs qui l'ont activé, une fois par jour, à partir de
 * l'heure choisie. Pas d'envoi les jours sans cotation (jour férié) ni sans ordre. Si tous
 * les canaux échouent, le résumé n'est pas consigné et sera retenté au cycle suivant.
 */
export async function sendDailySummaries({
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
    if (!s.summaryEnabled || s.lastSummaryOn === day || minutes < timeToMinutes(s.summaryTime)) {
      continue;
    }
    try {
      const orders = await store.listUserOrders(s.userId);
      if (orders.length === 0) continue;

      const instruments = (await store.listTrackedInstruments()).map((i) => ({
        id: i.id,
        symbol: i.symbol,
        name: i.name,
      }));
      const ids = [...new Set(orders.map((o) => o.instrumentId))];
      const stored = await store.getQuotes(ids);
      if (![...stored.values()].some((q) => parisDate(q.quotedAt) === day)) continue;

      const view = buildPortfolioView(
        orders,
        instruments,
        new Map(
          [...stored].map(([id, q]) => [
            id,
            {
              instrumentId: id,
              price: q.price,
              prevClose: q.prevClose,
              quotedAt: q.quotedAt.toISOString(),
              fetchedAt: q.fetchedAt.toISOString(),
            },
          ]),
        ),
      );
      const events = await store.listAlertEventsSince(s.userId, parisDayStart(day));
      const delivery = await notifier.notify(
        s,
        ['discord', 'email'],
        summaryMessage(day, view, events),
      );

      if (allFailed(delivery)) {
        log.warn('résumé non envoyé, nouvelle tentative au prochain cycle', { delivery });
        continue;
      }
      await store.markSummarySent(s.userId, day);
      sent++;
      log.info('résumé quotidien envoyé', { delivery });
    } catch (e) {
      log.error('résumé quotidien en échec', { error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { sent };
}

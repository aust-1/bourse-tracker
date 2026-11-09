import {
  buildPortfolioView,
  computePosition,
  evaluateAlert,
  isPollingWindow,
  isPortfolioAlert,
  nextHigh,
  parisDate,
  shouldRearm,
  type AlertContext,
  type QuoteRow,
} from '@bourse/core';
import type { Logger } from './log';
import { alertMessage } from './messages';
import { allFailed, type Notifier } from '@bourse/providers';
import type { FreshQuote } from './poll';
import type { AlertRow, Store } from './store';

interface Deps {
  store: Store;
  notifier: Pick<Notifier, 'notify'>;
  log: Logger;
  now?: Date;
}

/**
 * Contexte d'évaluation d'une alerte (cours, PRU, plus haut, ou totaux du portefeuille),
 * null si les données du cycle ne permettent pas de l'évaluer. Les calculs coûteux (position,
 * portefeuille d'un compte) sont faits une fois par cycle.
 */
function contextBuilder(quotes: readonly FreshQuote[], { store, log }: Deps) {
  const byInstrument = new Map(quotes.map((q) => [q.instrument.id, q]));
  const quoteRows = new Map<string, QuoteRow>(
    quotes.map((q) => [
      q.instrument.id,
      {
        instrumentId: q.instrument.id,
        price: q.price,
        prevClose: q.prevClose,
        quotedAt: q.quotedAt.toISOString(),
        fetchedAt: q.quotedAt.toISOString(),
      },
    ]),
  );
  const portfolios = new Map<string, Promise<AlertContext | null>>();

  const portfolioOf = (userId: string) => {
    let p = portfolios.get(userId);
    if (!p) {
      p = (async () => {
        const orders = await store.listUserOrders(userId);
        if (orders.length === 0) return null;
        const ids = [...new Set(orders.map((o) => o.instrumentId))];
        const { totals } = buildPortfolioView(
          orders,
          ids.map((id) => ({ id, symbol: '', name: '' })),
          quoteRows,
        );
        return { portfolioValue: totals.marketValue, portfolioDayPct: totals.dayPlPct };
      })().catch((e: unknown) => {
        log.warn('portefeuille illisible pour une alerte', { userId, error: String(e) });
        return null;
      });
      portfolios.set(userId, p);
    }
    return p;
  };

  return async (alert: AlertRow): Promise<{ ctx: AlertContext; quote?: FreshQuote } | null> => {
    if (isPortfolioAlert(alert.type)) {
      const ctx = await portfolioOf(alert.userId);
      return ctx ? { ctx } : null;
    }
    const q = alert.instrumentId ? byInstrument.get(alert.instrumentId) : undefined;
    if (!q) return null;
    const ctx: AlertContext = { price: q.price, prevClose: q.prevClose };
    if (alert.type.startsWith('position_pl')) {
      try {
        const pos = computePosition(await store.getOrders(alert.userId, alert.instrumentId!));
        ctx.avgCost = pos.quantity > 0 ? pos.avgCost : null;
      } catch (e) {
        log.warn('position illisible pour une alerte', { alert: alert.id, error: String(e) });
        return null;
      }
    }
    if (alert.type === 'drawdown_from_high') ctx.high = alert.referenceValue ?? null;
    return { ctx, quote: q };
  };
}

/**
 * Évalue les alertes contre les cotes du cycle. Une alerte ne part qu'une fois : elle est
 * « prise » (active → triggered) avant l'envoi, ce qui évite les doublons même si deux cycles
 * se chevauchent. Si tous les canaux échouent, elle est remise en `active` et retentée au cycle
 * suivant. Une alerte à réarmement automatique repasse en `active` une fois son délai écoulé et
 * sa condition redevenue fausse.
 * Hors fenêtre de séance, les cotes sont celles de la veille : on n'évalue rien.
 */
export async function evaluateAlerts(
  quotes: readonly FreshQuote[],
  deps: Deps,
): Promise<{ triggered: number; rearmed: number }> {
  const { store, notifier, log, now = new Date() } = deps;
  if (!isPollingWindow(now) || quotes.length === 0) return { triggered: 0, rearmed: 0 };

  const contextOf = contextBuilder(quotes, deps);
  let triggered = 0;
  let rearmed = 0;

  for (const alert of await store.listActiveAlerts()) {
    const found = await contextOf(alert);
    if (!found) continue;
    const { ctx, quote } = found;

    // baisse depuis le plus haut : le plus haut suit le cours (point de départ : création)
    if (alert.type === 'drawdown_from_high' && ctx.price !== undefined) {
      const high = nextHigh(alert.referenceValue ?? null, ctx.price);
      if (high !== alert.referenceValue) {
        await store.updateAlertReference(alert.id, high);
        ctx.high = high;
      }
    }

    const result = evaluateAlert({ type: alert.type, threshold: alert.threshold }, ctx);
    if (!result.triggered || result.value === null) continue;
    if (!(await store.claimAlert(alert.id, now))) continue;

    const settings = await store.getSettings(alert.userId);
    const message = alertMessage({
      type: alert.type,
      threshold: alert.threshold,
      name: quote?.instrument.name ?? 'Portefeuille',
      symbol: quote?.instrument.symbol,
      price: quote?.price,
      value: result.value,
      note: alert.note,
    });
    const delivery = await notifier.notify(settings, alert.channels, message);

    if (allFailed(delivery)) {
      await store.releaseAlert(alert.id);
      log.warn('alerte non envoyée, nouvelle tentative au prochain cycle', {
        alert: alert.id,
        delivery,
      });
      continue;
    }

    await store.recordAlertEvent({
      alertId: alert.id,
      userId: alert.userId,
      value: result.value,
      delivery,
    });
    triggered++;
    log.info('alerte déclenchée', { alert: alert.id, type: alert.type, delivery });
  }

  for (const alert of await store.listRearmableAlerts()) {
    const found = await contextOf(alert);
    if (!found) continue;
    const still = evaluateAlert({ type: alert.type, threshold: alert.threshold }, found.ctx);
    // une baisse depuis le plus haut repart du cours actuel : la condition est levée
    const stillTriggered = alert.type === 'drawdown_from_high' ? false : still.triggered;
    if (
      shouldRearm(
        {
          rearmMinutes: alert.rearmMinutes ?? null,
          lastTriggeredAt: alert.lastTriggeredAt ?? null,
        },
        stillTriggered,
        now,
      )
    ) {
      await store.rearmAlert(alert.id);
      rearmed++;
      log.info('alerte réarmée', { alert: alert.id, day: parisDate(now) });
    }
  }
  return { triggered, rearmed };
}

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
import { allFailed, allFailedPermanently, type Notifier } from '@bourse/providers';
import type { FreshQuote } from './poll';
import type { AlertRow, Store } from './store';

interface Deps {
  store: Store;
  notifier: Pick<Notifier, 'notify'>;
  log: Logger;
  now?: Date;
  /** Tentatives d'envoi en échec, d'un cycle à l'autre (une par worker : voir Cycle). */
  retries?: DeliveryRetries;
}

/** Délais entre deux tentatives d'envoi d'une alerte : 6 tentatives en un peu moins d'une heure. */
export const RETRY_DELAYS_MS = [60_000, 2 * 60_000, 5 * 60_000, 10 * 60_000, 30 * 60_000];

/**
 * Suivi des alertes dont aucun canal n'a abouti : la tentative suivante attend un délai croissant,
 * et le nombre de tentatives est borné. Tenu en mémoire : un redémarrage du worker repart de zéro,
 * ce qui borne tout de même les envois à quelques-uns par redémarrage.
 */
export class DeliveryRetries {
  private readonly state = new Map<string, { attempts: number; nextAt: number }>();

  constructor(private readonly delaysMs: readonly number[] = RETRY_DELAYS_MS) {}

  /** Vrai tant que le délai avant la prochaine tentative n'est pas écoulé. */
  waiting(alertId: string, now: Date): boolean {
    const s = this.state.get(alertId);
    return s !== undefined && now.getTime() < s.nextAt;
  }

  /** Consigne un échec ; renvoie l'heure de la prochaine tentative, ou null si c'était la dernière. */
  failed(alertId: string, now: Date): Date | null {
    const attempts = (this.state.get(alertId)?.attempts ?? 0) + 1;
    const delay = this.delaysMs[attempts - 1];
    if (delay === undefined) {
      this.state.delete(alertId);
      return null;
    }
    const nextAt = now.getTime() + delay;
    this.state.set(alertId, { attempts, nextAt });
    return new Date(nextAt);
  }

  attempts(alertId: string): number {
    return this.state.get(alertId)?.attempts ?? 0;
  }

  clear(alertId: string): void {
    this.state.delete(alertId);
  }
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
 * se chevauchent. Si tous les canaux échouent pour une panne passagère, elle est remise en
 * `active` et retentée après un délai croissant (`DeliveryRetries`) ; sur une erreur définitive ou
 * après la dernière tentative, l'échec est consigné dans l'historique. Une alerte à réarmement automatique repasse en `active` une fois son délai écoulé et
 * sa condition redevenue fausse.
 * Hors fenêtre de séance, les cotes sont celles de la veille : on n'évalue rien.
 */
export async function evaluateAlerts(
  quotes: readonly FreshQuote[],
  deps: Deps,
): Promise<{ triggered: number; rearmed: number }> {
  const { store, notifier, log, now = new Date(), retries = new DeliveryRetries() } = deps;
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
    // envoi précédent en échec : on attend le délai avant de retenter
    if (retries.waiting(alert.id, now)) continue;
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
      // panne passagère : nouvelle tentative plus tard (délai croissant, nombre borné) ;
      // erreur définitive (4xx, réglage invalide) ou dernière tentative : l'échec est consigné
      // dans l'historique avec l'état de chaque canal, et l'alerte reste « Déclenchée »
      const retryAt = allFailedPermanently(delivery) ? null : retries.failed(alert.id, now);
      if (retryAt) {
        await store.releaseAlert(alert.id);
        log.warn('alerte non envoyée, nouvelle tentative plus tard', {
          alert: alert.id,
          attempt: retries.attempts(alert.id),
          retryAt: retryAt.toISOString(),
          delivery,
        });
        continue;
      }
      retries.clear(alert.id);
      await store.recordAlertEvent({
        alertId: alert.id,
        userId: alert.userId,
        value: result.value,
        delivery,
      });
      log.warn('alerte non envoyée : échec consigné dans l’historique', {
        alert: alert.id,
        delivery,
      });
      continue;
    }
    retries.clear(alert.id);

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

import { computePosition, evaluateAlert, isPollingWindow } from '@bourse/core';
import type { Logger } from './log';
import { alertMessage } from './messages';
import { allFailed, type Notifier } from '@bourse/providers';
import type { FreshQuote } from './poll';
import type { Store } from './store';

interface Deps {
  store: Store;
  notifier: Pick<Notifier, 'notify'>;
  log: Logger;
  now?: Date;
}

/**
 * Évalue les alertes actives contre les cotes du cycle. Une alerte ne part qu'une fois :
 * elle est « prise » (active → triggered) avant l'envoi, ce qui évite les doublons même
 * si deux cycles se chevauchent. Si tous les canaux échouent, elle est remise en `active`
 * et sera retentée au cycle suivant.
 * Hors fenêtre de séance, les cotes sont celles de la veille : on n'évalue rien.
 */
export async function evaluateAlerts(
  quotes: readonly FreshQuote[],
  { store, notifier, log, now = new Date() }: Deps,
): Promise<{ triggered: number }> {
  if (!isPollingWindow(now) || quotes.length === 0) return { triggered: 0 };

  const byInstrument = new Map(quotes.map((q) => [q.instrument.id, q]));
  const alerts = await store.listActiveAlerts();
  let triggered = 0;

  for (const alert of alerts) {
    const q = byInstrument.get(alert.instrumentId);
    if (!q) continue;

    let avgCost: number | null = null;
    if (alert.type.startsWith('position_pl')) {
      try {
        const pos = computePosition(await store.getOrders(alert.userId, alert.instrumentId));
        avgCost = pos.quantity > 0 ? pos.avgCost : null;
      } catch (e) {
        log.warn('position illisible pour une alerte', { alert: alert.id, error: String(e) });
        continue;
      }
    }

    const result = evaluateAlert(
      { type: alert.type, threshold: alert.threshold },
      { price: q.price, prevClose: q.prevClose, avgCost },
    );
    if (!result.triggered || result.value === null) continue;

    if (!(await store.claimAlert(alert.id, now))) continue;

    const settings = await store.getSettings(alert.userId);
    const message = alertMessage({
      type: alert.type,
      threshold: alert.threshold,
      name: q.instrument.name,
      symbol: q.instrument.symbol,
      price: q.price,
      value: result.value,
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
  return { triggered };
}

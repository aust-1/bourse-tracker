import type { Logger } from './log';
import type { Store } from './store';

/**
 * Une alerte prise depuis moins longtemps peut être en cours d'envoi par une autre exécution du
 * worker (déploiement qui se chevauche) : on ne la touche pas.
 */
export const INTERRUPTED_AFTER_MS = 2 * 60_000;

/**
 * Au démarrage : une alerte prise (`triggered`) sans événement d'historique depuis sa prise a été
 * interrompue entre la prise et l'envoi (arrêt du worker). Elle est remise en `active` : elle
 * repartira au prochain cycle si sa condition est toujours vraie.
 */
export async function releaseInterruptedAlerts({
  store,
  log,
  now = new Date(),
}: {
  store: Pick<Store, 'releaseInterruptedAlerts'>;
  log: Logger;
  now?: Date;
}): Promise<number> {
  const ids = await store.releaseInterruptedAlerts(new Date(now.getTime() - INTERRUPTED_AFTER_MS));
  if (ids.length > 0) {
    log.warn('alertes interrompues avant envoi, remises en active', { alerts: ids });
  }
  return ids.length;
}

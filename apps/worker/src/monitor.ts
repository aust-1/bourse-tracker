import { isPollingWindow } from '@bourse/core';
import type { Message } from '@bourse/providers';

/**
 * Surveille la source de prix : si aucun cycle n'obtient de cotes pendant plus de
 * `staleAfterMs` en séance, envoie une alerte (une seule par panne) puis un message
 * de rétablissement. Hors séance, rien ne peut être « périmé ».
 */
export class SourceMonitor {
  private lastSuccess: Date;
  private alerted = false;

  constructor(
    private readonly staleAfterMs: number,
    start: Date,
  ) {
    this.lastSuccess = start;
  }

  async check(now: Date, cycleOk: boolean, send: (m: Message) => Promise<void>): Promise<void> {
    if (cycleOk || !isPollingWindow(now)) {
      this.lastSuccess = now;
      if (this.alerted && cycleOk) {
        this.alerted = false;
        await send({
          title: '✅ Source de prix rétablie',
          body: 'Les cotes sont de nouveau récupérées normalement.',
          level: 'success',
        });
      }
      return;
    }

    const minutes = Math.round((now.getTime() - this.lastSuccess.getTime()) / 60_000);
    if (!this.alerted && now.getTime() - this.lastSuccess.getTime() > this.staleAfterMs) {
      this.alerted = true;
      await send({
        title: '⚠️ Source de prix indisponible',
        body: `Aucune cote récupérée depuis ${minutes} min alors que la séance est ouverte. Les alertes de prix ne peuvent pas se déclencher.`,
        level: 'warning',
      });
    }
  }
}

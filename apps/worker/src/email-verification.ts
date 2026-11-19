import { createHash, randomInt } from 'node:crypto';
import type { Notifier } from '@bourse/providers';
import type { Logger } from './log';
import type { Store } from './store';

/** Durée de validité d'un code de confirmation (même valeur que confirm_notification_email). */
export const CODE_TTL_MS = 30 * 60_000;

export const hashCode = (code: string) => createHash('sha256').update(code, 'utf8').digest('hex');

/** Code à 6 chiffres, tiré par un générateur cryptographique. */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

interface Deps {
  store: Pick<Store, 'listEmailVerificationRequests' | 'saveEmailVerificationCode'>;
  notifier: Pick<Notifier, 'notify'>;
  log: Logger;
  now?: Date;
  code?: () => string;
}

/**
 * Envoie les codes de confirmation demandés depuis les réglages. Le code n'existe qu'ici et dans
 * l'email : la base n'en garde que l'empreinte, le navigateur ne le voit jamais.
 */
export async function sendEmailVerificationCodes({
  store,
  notifier,
  log,
  now = new Date(),
  code = newCode,
}: Deps): Promise<{ sent: number }> {
  let sent = 0;
  for (const r of await store.listEmailVerificationRequests()) {
    const value = code();
    const saved = await store.saveEmailVerificationCode(
      r.userId,
      r.email,
      hashCode(value),
      new Date(now.getTime() + CODE_TTL_MS),
    );
    if (!saved) continue; // adresse changée entre-temps
    const delivery = await notifier.notify({ discordWebhookUrl: null, email: r.email }, ['email'], {
      title: 'Bourse Tracker : confirme ton adresse',
      body: `Ton code de confirmation : ${value}\n\nSaisis-le dans les réglages de Bourse Tracker (valable 30 minutes). Si tu n'es pas à l'origine de cette demande, ignore ce message.`,
      level: 'info',
    });
    if (delivery.email === 'sent') {
      sent++;
      log.info('code de confirmation envoyé', { userId: r.userId });
    } else {
      log.warn('code de confirmation non envoyé', { userId: r.userId, delivery });
    }
  }
  return { sent };
}

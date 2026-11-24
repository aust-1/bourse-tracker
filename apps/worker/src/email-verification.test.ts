import { describe, expect, it, vi } from 'vitest';
import type { Delivery, Message, NotifyTarget } from '@bourse/providers';
import { CODE_TTL_MS, hashCode, newCode, sendEmailVerificationCodes } from './email-verification';
import { silentLogger } from './log';
import { MemoryStore } from './memory-store';

const now = new Date('2026-11-19T20:00:00Z');
const notifierReturning = (d: Delivery) => ({
  notify: vi.fn(async (_s: NotifyTarget | null, _c: readonly string[], _m: Message) => d),
});

describe('sendEmailVerificationCodes', () => {
  it('envoie le code à l’adresse demandée et ne garde que son empreinte', async () => {
    const store = new MemoryStore();
    store.verificationRequests = [{ userId: 'u1', email: 'tiers@example.com' }];
    const notifier = notifierReturning({ email: 'sent' });
    const r = await sendEmailVerificationCodes({
      store,
      notifier,
      log: silentLogger,
      now,
      code: () => '042317',
    });
    expect(r.sent).toBe(1);
    const [target, channels, message] = notifier.notify.mock.calls[0]!;
    expect(target).toMatchObject({ email: 'tiers@example.com' });
    expect(channels).toEqual(['email']);
    expect(message.body).toContain('042317');
    expect(store.verificationCodes.get('u1')).toEqual({
      email: 'tiers@example.com',
      codeHash: hashCode('042317'),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    });
    // demande servie : rien au cycle suivant
    await sendEmailVerificationCodes({ store, notifier, log: silentLogger, now });
    expect(notifier.notify).toHaveBeenCalledTimes(1);
  });

  it('adresse changée entre-temps : aucun envoi', async () => {
    const store = new MemoryStore();
    store.verificationRequests = [{ userId: 'u1', email: 'a@example.com' }];
    store.saveEmailVerificationCode = vi.fn(async () => false);
    const notifier = notifierReturning({ email: 'sent' });
    await sendEmailVerificationCodes({ store, notifier, log: silentLogger, now });
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it('code à 6 chiffres, empreinte sha256', () => {
    expect(newCode()).toMatch(/^\d{6}$/);
    expect(hashCode('123456')).toBe(
      '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    );
  });
});

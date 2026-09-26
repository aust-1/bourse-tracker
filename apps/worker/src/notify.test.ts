import { describe, expect, it, vi } from 'vitest';
import { alertMessage, describeCondition } from './messages';
import { SourceMonitor } from './monitor';
import { allFailed, isDiscordWebhook, Notifier } from './notify';

const ok = () => new Response(null, { status: 204 });
// Intl insère des espaces insécables dans les montants
const norm = (s: string) => s.replace(/\s+/g, ' ');
const settings = {
  discordWebhookUrl: 'https://discord.com/api/webhooks/1/abc',
  email: 'me@example.com',
};
const msg = { title: 'Titre', body: 'Corps' };

describe('isDiscordWebhook', () => {
  it.each([
    ['https://discord.com/api/webhooks/1/abc', true],
    ['https://canary.discord.com/api/webhooks/1/abc', true],
    ['https://discordapp.com/api/webhooks/1/abc', true],
    ['http://discord.com/api/webhooks/1/abc', false],
    ['https://evil.com/api/webhooks/1/abc', false],
    ['https://discord.com.evil.com/api/webhooks/1/abc', false],
    ['https://discord.com/other', false],
    ['pas une url', false],
  ])('%s -> %s', (url, expected) => {
    expect(isDiscordWebhook(url)).toBe(expected);
  });
});

describe('Notifier', () => {
  it('envoie un embed Discord et un email Resend', async () => {
    const fetch = vi.fn().mockResolvedValue(ok());
    const n = new Notifier({ resendApiKey: 're_123', emailFrom: 'Test <a@b.c>', fetch });
    const d = await n.notify(settings, ['discord', 'email'], msg);
    expect(d).toEqual({ discord: 'sent', email: 'sent' });

    const [discordUrl, discordInit] = fetch.mock.calls[0]!;
    expect(discordUrl).toBe(settings.discordWebhookUrl);
    expect(JSON.parse(discordInit.body).embeds[0].title).toBe('Titre');

    const [resendUrl, resendInit] = fetch.mock.calls[1]!;
    expect(resendUrl).toBe('https://api.resend.com/emails');
    expect(resendInit.headers.Authorization).toBe('Bearer re_123');
    expect(JSON.parse(resendInit.body)).toMatchObject({ to: ['me@example.com'], subject: 'Titre' });
  });

  it("un canal en échec n'empêche pas l'autre", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(ok());
    const n = new Notifier({ resendApiKey: 're_123', emailFrom: 'x', fetch });
    const d = await n.notify(settings, ['discord', 'email'], msg);
    expect(d.discord).toBe('error: Discord HTTP 500');
    expect(d.email).toBe('sent');
    expect(allFailed(d)).toBe(false);
  });

  it('canaux non configurés', async () => {
    const fetch = vi.fn();
    const n = new Notifier({ resendApiKey: null, emailFrom: 'x', fetch });
    expect(await n.notify(null, ['discord', 'email'], msg)).toEqual({
      discord: 'not_configured',
      email: 'not_configured',
    });
    expect(await n.notify(settings, ['email'], msg)).toEqual({ email: 'not_configured' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuse un webhook qui n'est pas Discord (aucun appel réseau)", async () => {
    const fetch = vi.fn();
    const n = new Notifier({ resendApiKey: null, emailFrom: 'x', fetch });
    const d = await n.notify(
      { discordWebhookUrl: 'https://evil.com/api/webhooks/1/x', email: null },
      ['discord'],
      msg,
    );
    expect(d.discord).toMatch(/^error:/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allFailed', () => {
    expect(allFailed({ discord: 'error: x' })).toBe(true);
    expect(allFailed({ discord: 'error: x', email: 'sent' })).toBe(false);
    expect(allFailed({ discord: 'not_configured' })).toBe(false);
    expect(allFailed({})).toBe(false);
  });
});

describe('messages', () => {
  it('décrit chaque condition', () => {
    expect(norm(describeCondition('price_above', 105))).toBe('cours ≥ 105,00 €');
    expect(norm(describeCondition('day_change_down', -5))).toContain('-5,00 %');
    expect(norm(describeCondition('position_pl_above', 20))).toContain('+20,00 %');
  });

  it("message d'alerte", () => {
    const m = alertMessage({
      type: 'price_below',
      threshold: 100,
      name: 'Amundi World',
      symbol: 'CW8.PA',
      price: 99.5,
      value: 99.5,
    });
    expect(norm(m.title)).toBe('🔔 Amundi World : cours ≤ 100,00 €');
    expect(norm(m.body)).toContain('CW8.PA cote 99,50 €');
  });
});

describe('SourceMonitor', () => {
  const t = (min: number) => new Date(Date.parse('2026-09-25T07:00:00Z') + min * 60_000); // séance
  const stale = 5 * 60_000;

  it('alerte une fois après le délai puis signale le rétablissement', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const m = new SourceMonitor(stale, t(0));
    await m.check(t(1), false, send);
    await m.check(t(4), false, send);
    expect(send).not.toHaveBeenCalled();
    await m.check(t(6), false, send);
    await m.check(t(7), false, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].title).toContain('indisponible');
    await m.check(t(8), true, send);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0].title).toContain('rétablie');
  });

  it("hors séance : jamais d'alerte, et le compteur repart à l'ouverture", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const m = new SourceMonitor(stale, new Date('2026-09-24T20:00:00Z'));
    await m.check(new Date('2026-09-25T06:54:00Z'), false, send); // 08:54 Paris : hors fenêtre
    await m.check(new Date('2026-09-25T06:56:00Z'), false, send); // 08:56 Paris : 2 min après la reprise
    expect(send).not.toHaveBeenCalled();
    await m.check(new Date('2026-09-25T07:02:00Z'), false, send); // 8 min sans cote en séance
    expect(send).toHaveBeenCalledTimes(1);
  });
});

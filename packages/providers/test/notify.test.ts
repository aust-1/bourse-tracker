import { describe, expect, it, vi } from 'vitest';
import { allFailed, isDiscordWebhook, Notifier } from '../src';

const ok = () => new Response(null, { status: 204 });
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

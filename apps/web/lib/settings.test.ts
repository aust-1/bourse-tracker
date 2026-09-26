import { describe, expect, it } from 'vitest';
import { describeDelivery, parseSettingsForm } from './settings';

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

const valid = {
  discordWebhookUrl: 'https://discord.com/api/webhooks/1/abc',
  email: 'moi@example.com',
  summaryEnabled: 'on',
  summaryTime: '17:45',
};

describe('parseSettingsForm', () => {
  it('accepte des réglages valides', () => {
    expect(parseSettingsForm(form(valid)).data).toEqual({
      discordWebhookUrl: 'https://discord.com/api/webhooks/1/abc',
      email: 'moi@example.com',
      summaryEnabled: true,
      summaryTime: '17:45',
    });
  });

  it('champs vides = null ; case décochée = false', () => {
    const r = parseSettingsForm(form({ discordWebhookUrl: '  ', email: '', summaryTime: '18:00' }));
    expect(r.data).toEqual({
      discordWebhookUrl: null,
      email: null,
      summaryEnabled: false,
      summaryTime: '18:00',
    });
  });

  it.each([
    [{ discordWebhookUrl: 'https://evil.com/api/webhooks/1/x' }, /Discord/],
    [{ discordWebhookUrl: 'http://discord.com/api/webhooks/1/x' }, /Discord/],
    [{ email: 'pas-un-email' }, /email/i],
    [{ summaryTime: '17:44' }, /entre 17:45 et 22:30/],
    [{ summaryTime: '23:00' }, /entre 17:45 et 22:30/],
    [{ summaryTime: '18h' }, /Heure/],
  ])('rejette %j', (patch, msg) => {
    const r = parseSettingsForm(form({ ...valid, ...patch }));
    expect(r.data).toBeUndefined();
    expect(r.error).toMatch(msg);
  });
});

describe('describeDelivery', () => {
  it('traduit les statuts', () => {
    expect(describeDelivery('discord', 'sent')).toContain('envoyé');
    expect(describeDelivery('email', 'not_configured')).toContain('non configuré');
    expect(describeDelivery('email', 'error: Resend HTTP 403')).toBe(
      'Email : échec (Resend HTTP 403)',
    );
  });
});

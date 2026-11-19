import { describe, expect, it, vi } from 'vitest';
import { discordEmbeds, Notifier } from '../src';

const ok = () => new Response(null, { status: 204 });
const settings = { discordWebhookUrl: 'https://discord.com/api/webhooks/1/abc', email: null };
const msg = { title: 'Titre', body: 'Corps' };

describe('Discord : un embed par titre', () => {
  const section = (i: number) => ({
    title: `Titre ${i}`,
    body: `Cours ${i} €`,
    level: 'success' as const,
  });

  it('embed principal puis un embed par section', () => {
    const embeds = discordEmbeds({ ...msg, sections: [section(1), section(2)] });
    expect(embeds.map((e) => e.title)).toEqual(['Titre', 'Titre 1', 'Titre 2']);
    expect(embeds[1]!.description).toBe('Cours 1 €');
    expect(embeds[1]!.color).not.toBe(embeds[0]!.color);
  });

  it('sans section : un seul embed, comme avant', () => {
    expect(discordEmbeds(msg)).toHaveLength(1);
  });

  it('au plus 10 embeds : le dernier annonce les lignes restantes', () => {
    const embeds = discordEmbeds({
      ...msg,
      sections: Array.from({ length: 12 }, (_, i) => section(i + 1)),
    });
    expect(embeds).toHaveLength(10);
    expect(embeds[9]!.title).toBe('+ 4 autres lignes');
  });

  it('exactement 9 sections : toutes affichées', () => {
    const embeds = discordEmbeds({
      ...msg,
      sections: Array.from({ length: 9 }, (_, i) => section(i + 1)),
    });
    expect(embeds).toHaveLength(10);
    expect(embeds[9]!.title).toBe('Titre 9');
  });

  it('reste sous la limite de 6 000 caractères de Discord', () => {
    const long = (i: number) => ({ title: `T${i}`, body: 'x'.repeat(1000) });
    const embeds = discordEmbeds({
      ...msg,
      sections: Array.from({ length: 8 }, (_, i) => long(i)),
    });
    const size = embeds.reduce((n, e) => n + e.title.length + e.description.length, 0);
    expect(size).toBeLessThanOrEqual(6000);
  });

  it('envoyés en un seul message', async () => {
    const fetch = vi.fn().mockResolvedValue(ok());
    const n = new Notifier({ resendApiKey: null, emailFrom: 'x', fetch });
    await n.notify(settings, ['discord'], { ...msg, sections: [section(1)] });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0]![1].body).embeds).toHaveLength(2);
  });
});

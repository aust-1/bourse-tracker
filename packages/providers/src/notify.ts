/** Message à notifier. `level` colore l'embed Discord. */
export interface Message {
  title: string;
  body: string;
  level?: 'info' | 'warning' | 'success';
}

export interface NotifyTarget {
  discordWebhookUrl: string | null;
  email: string | null;
  /** Sujet ntfy complet : https://ntfy.sh/mon-sujet (ou serveur auto-hébergé) */
  ntfyUrl?: string | null;
  /** Identifiant de conversation Telegram avec le robot de l'instance */
  telegramChatId?: string | null;
}

/** Tous les canaux : messages système, résumé et rapports partent sur ceux qui sont configurés. */
export const ALL_CHANNELS = ['discord', 'email', 'ntfy', 'telegram'] as const;
export type Channel = (typeof ALL_CHANNELS)[number];

export type DeliveryStatus = 'sent' | 'not_configured' | `error: ${string}`;
export type Delivery = Record<string, DeliveryStatus>;

const ALLOWED_DISCORD_HOSTS = ['discord.com', 'discordapp.com'];

/** N'accepte que de vrais webhooks Discord (la valeur vient d'un champ de saisie). */
export function isDiscordWebhook(raw: string): boolean {
  try {
    const u = new URL(raw);
    const hostOk = ALLOWED_DISCORD_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
    );
    return u.protocol === 'https:' && hostOk && u.pathname.startsWith('/api/webhooks/');
  } catch {
    return false;
  }
}

/** Sujet ntfy : https, un seul segment de chemin (le nom du sujet). */
export function isNtfyUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && /^\/[A-Za-z0-9_-]{1,64}$/.test(u.pathname) && !u.search;
  } catch {
    return false;
  }
}

/** Identifiant de conversation Telegram (négatif pour un groupe). */
export const isTelegramChatId = (raw: string) => /^-?\d{1,20}$/.test(raw);

const COLORS = { info: 0x2a78d6, warning: 0xeda100, success: 0x1baf7a } as const;

export interface NotifierConfig {
  resendApiKey: string | null;
  emailFrom: string;
  /** Robot Telegram de l'instance (BotFather) ; null : canal indisponible */
  telegramBotToken?: string | null;
  fetch?: typeof fetch;
}

export class Notifier {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly cfg: NotifierConfig) {
    this.fetchImpl = cfg.fetch ?? fetch;
  }

  async sendDiscord(webhookUrl: string, msg: Message): Promise<void> {
    if (!isDiscordWebhook(webhookUrl)) throw new Error('URL de webhook Discord invalide');
    const res = await this.fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: msg.title.slice(0, 256),
            description: msg.body.slice(0, 4000),
            color: COLORS[msg.level ?? 'info'],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Discord HTTP ${res.status}`);
  }

  async sendEmail(to: string, msg: Message): Promise<void> {
    if (!this.cfg.resendApiKey) throw new Error('clé Resend absente');
    const res = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.cfg.emailFrom,
        to: [to],
        subject: msg.title,
        text: msg.body,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend HTTP ${res.status}`);
  }

  async sendNtfy(topicUrl: string, msg: Message): Promise<void> {
    if (!isNtfyUrl(topicUrl)) throw new Error('URL ntfy invalide');
    const u = new URL(topicUrl);
    // publication JSON : titre et texte en UTF-8 (un en-tête HTTP ne porte pas les accents)
    const res = await this.fetchImpl(`${u.origin}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: u.pathname.slice(1),
        title: msg.title,
        message: msg.body,
        tags: [msg.level === 'warning' ? 'warning' : 'chart_with_upwards_trend'],
        priority: msg.level === 'warning' ? 4 : 3,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
  }

  async sendTelegram(chatId: string, msg: Message): Promise<void> {
    if (!this.cfg.telegramBotToken) throw new Error('robot Telegram absent');
    if (!isTelegramChatId(chatId)) throw new Error('identifiant Telegram invalide');
    const res = await this.fetchImpl(
      `https://api.telegram.org/bot${this.cfg.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: [msg.title, '', msg.body].join('\n').slice(0, 4096),
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
  }

  /** Envoie sur les canaux demandés ; ne lève jamais, rapporte l'état de chaque canal. */
  async notify(
    settings: NotifyTarget | null,
    channels: readonly string[],
    msg: Message,
  ): Promise<Delivery> {
    const delivery: Delivery = {};
    for (const channel of channels) {
      try {
        if (channel === 'discord') {
          if (!settings?.discordWebhookUrl) {
            delivery.discord = 'not_configured';
            continue;
          }
          await this.sendDiscord(settings.discordWebhookUrl, msg);
        } else if (channel === 'email') {
          if (!settings?.email || !this.cfg.resendApiKey) {
            delivery.email = 'not_configured';
            continue;
          }
          await this.sendEmail(settings.email, msg);
        } else if (channel === 'ntfy') {
          if (!settings?.ntfyUrl) {
            delivery.ntfy = 'not_configured';
            continue;
          }
          await this.sendNtfy(settings.ntfyUrl, msg);
        } else if (channel === 'telegram') {
          if (!settings?.telegramChatId || !this.cfg.telegramBotToken) {
            delivery.telegram = 'not_configured';
            continue;
          }
          await this.sendTelegram(settings.telegramChatId, msg);
        } else {
          continue;
        }
        delivery[channel] = 'sent';
      } catch (e) {
        delivery[channel] = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    return delivery;
  }
}

/** Vrai si au moins un canal a échoué et qu'aucun n'a abouti (on doit réessayer). */
export function allFailed(d: Delivery): boolean {
  const statuses = Object.values(d);
  return (
    statuses.length > 0 &&
    statuses.some((s) => s.startsWith('error')) &&
    !statuses.some((s) => s === 'sent')
  );
}

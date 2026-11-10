-- Canaux ntfy (notifications push) et Telegram (robot de l'instance).
alter table public.settings
  add column ntfy_url text check (ntfy_url is null or ntfy_url ~ '^https://[^/?#]+/[A-Za-z0-9_-]{1,64}$'),
  add column telegram_chat_id text check (telegram_chat_id is null or telegram_chat_id ~ '^-?[0-9]{1,20}$');

alter table public.alerts drop constraint alerts_channels_valid;
alter table public.alerts add constraint alerts_channels_valid check (
  cardinality(channels) > 0 and channels <@ array['discord', 'email', 'ntfy', 'telegram']
);

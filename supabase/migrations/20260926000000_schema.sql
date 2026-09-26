-- Schéma initial Bourse Tracker (M1)
-- Conventions : tout en EUR ; `alerts.threshold` est signé et comparé tel quel
--   *_above : valeur >= seuil      *_below : valeur <= seuil
-- Départage des ordres au même instant : achats avant ventes, puis id (cf. packages/core).

create type public.order_side as enum ('buy', 'sell');
create type public.alert_type as enum (
  'price_above', 'price_below',
  'day_change_up', 'day_change_down',
  'position_pl_above', 'position_pl_below'
);
create type public.alert_status as enum ('active', 'triggered', 'paused');

-- ---------------------------------------------------------------------------
-- Données de référence (partagées) et cotes : écrites par le worker (service_role)
-- ---------------------------------------------------------------------------
create table public.instruments (
  id           uuid primary key default gen_random_uuid(),
  isin         text,
  yahoo_symbol text not null unique,
  name         text not null,
  exchange     text,
  currency     text not null default 'EUR' check (currency = 'EUR'),
  created_at   timestamptz not null default now()
);

create table public.quotes_latest (
  instrument_id uuid primary key references public.instruments (id) on delete cascade,
  price         numeric(18, 6) not null check (price >= 0),
  prev_close    numeric(18, 6) check (prev_close >= 0),
  quoted_at     timestamptz not null,
  fetched_at    timestamptz not null default now()
);

create table public.price_history (
  instrument_id uuid not null references public.instruments (id) on delete cascade,
  date          date not null,
  close         numeric(18, 6) not null check (close >= 0),
  primary key (instrument_id, date)
);

create table public.worker_status (
  id            smallint primary key default 1 check (id = 1),
  last_cycle_at timestamptz,
  last_error    text
);
insert into public.worker_status (id) values (1);

-- ---------------------------------------------------------------------------
-- Données de l'utilisateur
-- ---------------------------------------------------------------------------
create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  instrument_id uuid not null references public.instruments (id),
  side          public.order_side not null,
  quantity      numeric(18, 6) not null check (quantity > 0),
  unit_price    numeric(18, 6) not null check (unit_price >= 0),
  fees          numeric(12, 4) not null default 0 check (fees >= 0),
  executed_at   timestamptz not null,
  note          text,
  created_at    timestamptz not null default now()
);
create index orders_user_instrument_idx on public.orders (user_id, instrument_id, executed_at);
create index orders_instrument_idx on public.orders (instrument_id);

create table public.portfolio_snapshots (
  user_id      uuid not null references auth.users (id) on delete cascade,
  date         date not null,
  market_value numeric(18, 4) not null,
  cost_basis   numeric(18, 4) not null,
  realized_pl  numeric(18, 4) not null,
  primary key (user_id, date)
);

create table public.alerts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  instrument_id     uuid not null references public.instruments (id),
  type              public.alert_type not null,
  threshold         numeric(18, 6) not null,
  channels          text[] not null default array['discord', 'email'],
  status            public.alert_status not null default 'active',
  last_triggered_at timestamptz,
  created_at        timestamptz not null default now(),
  constraint alerts_channels_valid check (
    cardinality(channels) > 0 and channels <@ array['discord', 'email']
  ),
  constraint alerts_price_positive check (
    type not in ('price_above', 'price_below') or threshold > 0
  )
);
create index alerts_user_idx on public.alerts (user_id);
create index alerts_active_idx on public.alerts (instrument_id) where status = 'active';

create table public.alert_events (
  id               uuid primary key default gen_random_uuid(),
  alert_id         uuid not null references public.alerts (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  value_at_trigger numeric(18, 6) not null,
  triggered_at     timestamptz not null default now(),
  delivery         jsonb not null default '{}'::jsonb
);
create index alert_events_alert_idx on public.alert_events (alert_id);
create index alert_events_user_idx on public.alert_events (user_id, triggered_at desc);

create table public.settings (
  user_id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  discord_webhook_url text check (discord_webhook_url is null or discord_webhook_url like 'https://%'),
  email              text,
  summary_enabled    boolean not null default true,
  summary_time       time not null default '17:45',
  last_summary_on    date
);

-- ---------------------------------------------------------------------------
-- Interdit toute vente à découvert (vérifié en base, pas seulement dans l'UI)
-- ---------------------------------------------------------------------------
create function public.assert_no_oversell(p_user uuid, p_instrument uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_min numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || p_instrument::text, 0));

  select min(running) into v_min
  from (
    select sum(case side when 'buy' then quantity else -quantity end)
             over (order by executed_at, side, id) as running
    from public.orders
    where user_id = p_user and instrument_id = p_instrument
  ) t;

  if v_min < 0 then
    raise exception 'Vente à découvert interdite : la quantité détenue deviendrait négative'
      using errcode = 'check_violation';
  end if;
end;
$$;

create function public.orders_check_oversell()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.assert_no_oversell(new.user_id, new.instrument_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE')
     and (tg_op = 'DELETE' or (old.user_id, old.instrument_id) is distinct from (new.user_id, new.instrument_id)) then
    perform public.assert_no_oversell(old.user_id, old.instrument_id);
  end if;
  return null;
end;
$$;

create trigger orders_no_oversell
after insert or update or delete on public.orders
for each row execute function public.orders_check_oversell();

-- ---------------------------------------------------------------------------
-- RLS : chaque table est protégée ; le worker utilise service_role (bypass)
-- ---------------------------------------------------------------------------
alter table public.instruments        enable row level security;
alter table public.quotes_latest      enable row level security;
alter table public.price_history      enable row level security;
alter table public.worker_status      enable row level security;
alter table public.orders             enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.alerts             enable row level security;
alter table public.alert_events       enable row level security;
alter table public.settings           enable row level security;

-- Référence : lecture pour les connectés ; l'ajout d'un instrument passe par l'app
create policy instruments_select on public.instruments for select to authenticated using (true);
create policy instruments_insert on public.instruments for insert to authenticated with check (true);
create policy quotes_select      on public.quotes_latest for select to authenticated using (true);
create policy history_select     on public.price_history for select to authenticated using (true);
create policy worker_status_select on public.worker_status for select to authenticated using (true);

-- Données perso
create policy orders_all on public.orders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy alerts_all on public.alerts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy settings_all on public.settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy snapshots_select on public.portfolio_snapshots for select to authenticated
  using (user_id = (select auth.uid()));
create policy alert_events_select on public.alert_events for select to authenticated
  using (user_id = (select auth.uid()));

-- Droits explicites (Supabase n'accorde plus rien par défaut) ; la RLS filtre ensuite les lignes
revoke all on all tables in schema public from anon, authenticated;

grant select on public.instruments, public.quotes_latest, public.price_history,
                public.worker_status, public.portfolio_snapshots, public.alert_events
  to authenticated;
grant insert on public.instruments to authenticated;
grant select, insert, update, delete on public.orders, public.alerts, public.settings
  to authenticated;

grant all on all tables in schema public to service_role;

-- Temps réel : seules les cotes sont diffusées
alter publication supabase_realtime add table public.quotes_latest;

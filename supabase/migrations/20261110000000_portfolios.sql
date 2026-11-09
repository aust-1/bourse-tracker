-- Plusieurs portefeuilles (enveloppes) par compte : PEA, PEA-PME, compte-titres.
-- Chaque ordre appartient à un portefeuille ; la vente à découvert est contrôlée par
-- portefeuille (des titres détenus sur le CTO ne se vendent pas depuis le PEA).

create type public.portfolio_kind as enum ('pea', 'pea_pme', 'cto');

create table public.portfolios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  kind       public.portfolio_kind not null default 'pea',
  -- date d'ouverture de l'enveloppe (ancienneté fiscale du PEA)
  opened_on  date,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  -- cible de la clé étrangère composite des ordres (portefeuille du même compte)
  unique (id, user_id)
);

alter table public.portfolios enable row level security;
create policy portfolios_all on public.portfolios for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy portfolios_access on public.portfolios as restrictive for all to authenticated
  using ((select public.access_ok())) with check ((select public.access_ok()));
grant select, insert, update, delete on public.portfolios to authenticated;
grant all on public.portfolios to service_role;

-- un portefeuille « PEA » pour chaque compte existant, et pour chaque nouveau compte
insert into public.portfolios (user_id, name, kind)
select user_id, 'PEA', 'pea' from public.profiles;

create function public.profiles_default_portfolio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.portfolios (user_id, name, kind) values (new.user_id, 'PEA', 'pea')
  on conflict do nothing;
  return null;
end;
$$;

create trigger profiles_default_portfolio
after insert on public.profiles
for each row execute function public.profiles_default_portfolio();

-- ---------------------------------------------------------------------------
-- Ordres rattachés à un portefeuille du même compte
-- ---------------------------------------------------------------------------
alter table public.orders add column portfolio_id uuid;

update public.orders o
   set portfolio_id = p.id
  from public.portfolios p
 where p.user_id = o.user_id;

alter table public.orders
  alter column portfolio_id set not null,
  add constraint orders_portfolio_fk foreign key (portfolio_id, user_id)
    references public.portfolios (id, user_id) on delete cascade;

create index orders_portfolio_instrument_idx
  on public.orders (portfolio_id, instrument_id, executed_at);

-- Sans portefeuille précisé (API, anciens clients) : le plus ancien du compte.
create function public.orders_default_portfolio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.portfolio_id is null then
    select id into new.portfolio_id
    from public.portfolios
    where user_id = new.user_id
    order by created_at, id
    limit 1;
    if new.portfolio_id is null then
      insert into public.portfolios (user_id, name, kind) values (new.user_id, 'PEA', 'pea')
      returning id into new.portfolio_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_default_portfolio
before insert on public.orders
for each row execute function public.orders_default_portfolio();

-- ---------------------------------------------------------------------------
-- Vente à découvert : par portefeuille
-- ---------------------------------------------------------------------------
drop function public.assert_no_oversell(uuid, uuid);

create function public.assert_no_oversell(p_portfolio uuid, p_instrument uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_min numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_portfolio::text || p_instrument::text, 0));
  select min(running) into v_min
  from (
    select sum(case side when 'buy' then quantity else -quantity end)
             over (order by executed_at, side, id) as running
    from public.orders
    where portfolio_id = p_portfolio and instrument_id = p_instrument
  ) t;
  if v_min < 0 then
    raise exception 'Vente à découvert interdite : la quantité détenue deviendrait négative'
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.orders_check_oversell()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.assert_no_oversell(new.portfolio_id, new.instrument_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE')
     and (tg_op = 'DELETE'
          or (old.portfolio_id, old.instrument_id) is distinct from (new.portfolio_id, new.instrument_id)) then
    perform public.assert_no_oversell(old.portfolio_id, old.instrument_id);
  end if;
  return null;
end;
$$;

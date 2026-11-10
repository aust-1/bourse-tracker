-- Divisions et regroupements de titres (splits). Un événement de marché, commun à tous les comptes :
-- saisi par l'administrateur, visible par ceux qui suivent le titre.
--
-- Les clôtures de Yahoo sont ajustées rétroactivement : pour rester cohérents, les ordres passés
-- avant la date d'effet sont convertis en titres « d'après » (quantité × to/from, prix × from/to).
-- Les ordres saisis restent tels qu'exécutés ; la conversion est faite au calcul.

create table public.splits (
  id            uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments (id) on delete cascade,
  -- premier jour de cotation sur la nouvelle base (date de Paris)
  effective_on  date not null,
  -- « ratio_from anciens titres deviennent ratio_to nouveaux » : 1 → 10 pour une division par 10
  ratio_from    integer not null check (ratio_from > 0),
  ratio_to      integer not null check (ratio_to > 0),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (instrument_id, effective_on),
  check (ratio_from <> ratio_to)
);

alter table public.splits enable row level security;
create policy splits_select on public.splits for select to authenticated
  using (instrument_id in (
    select instrument_id from public.user_instruments where user_id = (select auth.uid())
  ));
create policy splits_admin_insert on public.splits for insert to authenticated
  with check ((select public.is_admin()));
create policy splits_admin_delete on public.splits for delete to authenticated
  using ((select public.is_admin()));
create policy splits_access on public.splits as restrictive for all to authenticated
  using ((select public.access_ok())) with check ((select public.access_ok()));
grant select, insert, delete on public.splits to authenticated;
grant all on public.splits to service_role;

-- Facteur appliqué à la quantité d'un ordre exécuté à `p_at` : produit des splits postérieurs.
create function public.split_factor(p_instrument uuid, p_at timestamptz)
returns numeric
language sql
stable
set search_path = ''
as $$
  -- arrondi : exp/ln laissent un résidu (10.0000000000000002)
  select coalesce(round(exp(sum(ln(ratio_to::numeric / ratio_from))), 10), 1)
  from public.splits
  where instrument_id = p_instrument
    and effective_on > (p_at at time zone 'Europe/Paris')::date;
$$;

-- Vente à découvert : quantités converties en titres d'après les splits.
create or replace function public.assert_no_oversell(p_portfolio uuid, p_instrument uuid)
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
    select sum(
             (case side when 'buy' then quantity else -quantity end)
             * public.split_factor(instrument_id, executed_at)
           ) over (order by executed_at, side, id) as running
    from public.orders
    where portfolio_id = p_portfolio and instrument_id = p_instrument
  ) t;
  -- tolérance : exp/ln laissent des résidus d'arrondi
  if v_min < -0.000001 then
    raise exception 'Vente à découvert interdite : la quantité détenue deviendrait négative'
      using errcode = 'check_violation';
  end if;
end;
$$;

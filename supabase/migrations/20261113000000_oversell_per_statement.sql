-- Contrôle de la vente à découvert : une fois par instruction et par (portefeuille, titre), au lieu
-- d'une fois par ligne. Avec le déclencheur par ligne, un ajout groupé (import CSV, 1 000 ordres)
-- relisait tous les ordres du couple à chaque ligne : coût quadratique.

-- chemin rapide : sans split sur le titre, les quantités se comparent telles quelles
create or replace function public.assert_no_oversell(p_portfolio uuid, p_instrument uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_min numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_portfolio::text || p_instrument::text, 0));
  if exists (select 1 from public.splits where instrument_id = p_instrument) then
    select min(running) into v_min
    from (
      select sum(
               (case side when 'buy' then quantity else -quantity end)
               * public.split_factor(instrument_id, executed_at)
             ) over (order by executed_at, side, id) as running
      from public.orders
      where portfolio_id = p_portfolio and instrument_id = p_instrument
    ) t;
  else
    select min(running) into v_min
    from (
      select sum(case side when 'buy' then quantity else -quantity end)
               over (order by executed_at, side, id) as running
      from public.orders
      where portfolio_id = p_portfolio and instrument_id = p_instrument
    ) t;
  end if;
  -- tolérance : exp/ln (splits) laissent des résidus d'arrondi
  if v_min < -0.000001 then
    raise exception 'Vente à découvert interdite : la quantité détenue deviendrait négative'
      using errcode = 'check_violation';
  end if;
end;
$$;

create function public.orders_check_oversell_stmt()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  r record;
begin
  if tg_op = 'INSERT' then
    for r in select distinct portfolio_id, instrument_id from new_rows loop
      perform public.assert_no_oversell(r.portfolio_id, r.instrument_id);
    end loop;
  elsif tg_op = 'UPDATE' then
    for r in
      select portfolio_id, instrument_id from new_rows
      union
      select portfolio_id, instrument_id from old_rows
    loop
      perform public.assert_no_oversell(r.portfolio_id, r.instrument_id);
    end loop;
  else
    for r in select distinct portfolio_id, instrument_id from old_rows loop
      perform public.assert_no_oversell(r.portfolio_id, r.instrument_id);
    end loop;
  end if;
  return null;
end;
$$;

drop trigger orders_no_oversell on public.orders;
drop function public.orders_check_oversell();

-- une table de transition par événement : PostgreSQL n'en accepte pas sur un déclencheur multiple
create trigger orders_no_oversell_insert
after insert on public.orders
referencing new table as new_rows
for each statement execute function public.orders_check_oversell_stmt();

create trigger orders_no_oversell_update
after update on public.orders
referencing old table as old_rows new table as new_rows
for each statement execute function public.orders_check_oversell_stmt();

create trigger orders_no_oversell_delete
after delete on public.orders
referencing old table as old_rows
for each statement execute function public.orders_check_oversell_stmt();

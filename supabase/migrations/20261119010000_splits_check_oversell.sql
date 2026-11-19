-- Divisions de titres et vente à découvert.
--
-- Une division change la conversion des ordres antérieurs à sa date d'effet (voir la migration
-- splits). Le contrôle `assert_no_oversell` n'était déclenché que par les écritures sur `orders` :
-- supprimer une division, ou en changer la date, pouvait rendre la position d'un portefeuille
-- négative (vente saisie en titres « d'après »), et le tableau de bord du compte concerné
-- échouait ensuite sur `OversellError`. Toute écriture sur `splits` revérifie maintenant chaque
-- portefeuille qui a des ordres sur le titre.
--
-- `security definer` : l'administrateur qui modifie la division ne voit que ses propres ordres
-- (RLS) ; le contrôle doit porter sur ceux de tous les comptes.

create function public.splits_check_oversell_stmt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_instruments uuid[];
  r record;
begin
  -- une table de transition par événement (voir orders_check_oversell_stmt)
  if tg_op = 'INSERT' then
    select array_agg(distinct instrument_id) into v_instruments from new_rows;
  elsif tg_op = 'UPDATE' then
    select array_agg(distinct instrument_id) into v_instruments
    from (select instrument_id from new_rows union select instrument_id from old_rows) t;
  else
    select array_agg(distinct instrument_id) into v_instruments from old_rows;
  end if;

  for r in
    select distinct portfolio_id, instrument_id
    from public.orders
    where instrument_id = any (v_instruments)
  loop
    begin
      perform public.assert_no_oversell(r.portfolio_id, r.instrument_id);
    exception when check_violation then
      raise exception 'Division refusée : une vente déjà enregistrée dépasserait la quantité détenue dans un portefeuille'
        using errcode = 'check_violation';
    end;
  end loop;
  return null;
end;
$$;

create trigger splits_no_oversell_insert
after insert on public.splits
referencing new table as new_rows
for each statement execute function public.splits_check_oversell_stmt();

create trigger splits_no_oversell_update
after update on public.splits
referencing old table as old_rows new table as new_rows
for each statement execute function public.splits_check_oversell_stmt();

create trigger splits_no_oversell_delete
after delete on public.splits
referencing old table as old_rows
for each statement execute function public.splits_check_oversell_stmt();

revoke execute on function public.splits_check_oversell_stmt() from public, anon, authenticated;

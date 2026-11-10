-- Changement de symbole Yahoo (le titre change de code, de place de cotation…) sans perte :
-- l'instrument garde son identifiant, donc ses ordres, alertes, mouvements et clôtures.
-- Si le nouveau symbole est déjà suivi comme un autre instrument du même ISIN, les deux sont
-- fusionnés dans celui-ci.

create function public.admin_change_symbol(p_instrument uuid, p_symbol text, p_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_isin  text;
  v_other uuid;
  v_other_isin text;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = 'insufficient_privilege';
  end if;
  select isin into v_isin from public.instruments where id = p_instrument;
  if not found then
    raise exception 'Instrument introuvable' using errcode = 'no_data_found';
  end if;

  select id, isin into v_other, v_other_isin
  from public.instruments where yahoo_symbol = p_symbol and id <> p_instrument;

  if v_other is not null then
    if v_isin is null or v_other_isin is distinct from v_isin then
      raise exception 'Ce symbole appartient à un autre titre (ISIN différent ou inconnu)'
        using errcode = 'unique_violation';
    end if;
    -- fusion : une instruction par table (les contrôles de découvert, déclenchés en fin
    -- d'instruction, voient tous les ordres déplacés)
    update public.orders set instrument_id = p_instrument where instrument_id = v_other;
    update public.alerts set instrument_id = p_instrument where instrument_id = v_other;
    update public.cash_movements set instrument_id = p_instrument where instrument_id = v_other;
    insert into public.user_instruments (user_id, instrument_id, created_at)
      select user_id, p_instrument, created_at from public.user_instruments where instrument_id = v_other
      on conflict do nothing;
    insert into public.splits (instrument_id, effective_on, ratio_from, ratio_to, created_by, created_at)
      select p_instrument, effective_on, ratio_from, ratio_to, created_by, created_at
      from public.splits where instrument_id = v_other
      on conflict do nothing;
    -- clôtures manquantes reprises de l'autre instrument
    insert into public.price_history (instrument_id, date, close)
      select p_instrument, date, close from public.price_history where instrument_id = v_other
      on conflict do nothing;
    delete from public.instruments where id = v_other;
  end if;

  update public.instruments
     set yahoo_symbol = p_symbol, name = coalesce(nullif(trim(p_name), ''), name)
   where id = p_instrument;
end;
$$;

revoke execute on function public.admin_change_symbol(uuid, text, text) from public, anon;
grant execute on function public.admin_change_symbol(uuid, text, text) to authenticated;

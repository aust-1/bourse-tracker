-- Type d'actif (ETF / action) pour la répartition du portefeuille. Fourni par la source de prix :
-- à l'ajout d'un titre, et complété par le worker pour les titres déjà suivis.

alter table public.instruments
  add column asset_type text check (asset_type in ('etf', 'equity'));

-- nouvelle signature (p_type) : l'ancienne est supprimée pour éviter une surcharge ambiguë
drop function public.track_instrument(text, text, text);

create function public.track_instrument(
  p_symbol   text,
  p_name     text default null,
  p_exchange text default null,
  p_type     text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'Connexion requise' using errcode = 'insufficient_privilege';
  end if;
  if not public.access_ok() then
    raise exception 'Double authentification requise' using errcode = 'insufficient_privilege';
  end if;

  select id into v_id from public.instruments where yahoo_symbol = p_symbol;
  if v_id is null then
    if p_name is null then
      return null;
    end if;
    insert into public.instruments (yahoo_symbol, name, exchange, asset_type)
    values (p_symbol, p_name, p_exchange, p_type)
    on conflict (yahoo_symbol) do nothing
    returning id into v_id;
    if v_id is null then -- ajouté au même instant par un autre compte
      select id into v_id from public.instruments where yahoo_symbol = p_symbol;
    end if;
  end if;

  insert into public.user_instruments (user_id, instrument_id)
  values (v_user, v_id)
  on conflict do nothing;
  return v_id;
end;
$$;

revoke execute on function public.track_instrument(text, text, text, text) from public, anon;
grant execute on function public.track_instrument(text, text, text, text) to authenticated;

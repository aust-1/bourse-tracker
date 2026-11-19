-- Création d'un instrument par `track_instrument` : données bornées.
--
-- Les instruments sont communs à tous les comptes. Le nom, la place et le type transmis à la
-- création viennent du client (l'application les lit chez Yahoo, mais un appel direct à l'API
-- peut envoyer n'importe quoi). Le worker les remplace par ceux de la source de prix à la
-- première cotation ; d'ici là, la base n'accepte qu'un nom court et une place courte.

create or replace function public.track_instrument(
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
  v_name text := nullif(btrim(p_name), '');
begin
  if v_user is null then
    raise exception 'Connexion requise' using errcode = 'insufficient_privilege';
  end if;
  if not public.access_ok() then
    raise exception 'Double authentification requise' using errcode = 'insufficient_privilege';
  end if;

  select id into v_id from public.instruments where yahoo_symbol = p_symbol;
  if v_id is null then
    if v_name is null then
      return null;
    end if;
    if p_symbol !~ '^[\^A-Za-z0-9.=-]{1,20}$' then
      raise exception 'Symbole invalide' using errcode = 'invalid_parameter_value';
    end if;
    if char_length(v_name) > 120 or char_length(coalesce(p_exchange, '')) > 20 then
      raise exception 'Nom ou place de l''instrument trop long' using errcode = 'invalid_parameter_value';
    end if;
    insert into public.instruments (yahoo_symbol, name, exchange, asset_type)
    values (p_symbol, v_name, p_exchange, p_type)
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

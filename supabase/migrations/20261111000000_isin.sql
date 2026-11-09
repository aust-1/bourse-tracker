-- ISIN des instruments (Yahoo ne le fournit pas) : saisi sur la fiche du titre. Il sert d'indice
-- d'éligibilité au PEA (pays de l'émetteur) et d'identifiant stable du titre.

alter table public.instruments
  add constraint instruments_isin_format check (isin is null or isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$');

create index instruments_isin_idx on public.instruments (isin);

-- Le premier qui suit le titre peut renseigner l'ISIN ; le modifier ensuite est réservé à
-- l'administrateur (l'instrument est commun à tous les comptes).
create function public.set_instrument_isin(p_instrument uuid, p_isin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if auth.uid() is null or not public.access_ok() then
    raise exception 'Connexion requise' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.user_instruments
    where user_id = auth.uid() and instrument_id = p_instrument
  ) and not public.is_admin() then
    raise exception 'Instrument non suivi' using errcode = 'insufficient_privilege';
  end if;
  select isin into v_current from public.instruments where id = p_instrument;
  if not found then
    raise exception 'Instrument introuvable' using errcode = 'no_data_found';
  end if;
  if v_current is not null and v_current is distinct from p_isin and not public.is_admin() then
    raise exception 'ISIN déjà renseigné : seul l''administrateur peut le modifier'
      using errcode = 'insufficient_privilege';
  end if;
  update public.instruments set isin = p_isin where id = p_instrument;
end;
$$;

revoke execute on function public.set_instrument_isin(uuid, text) from public, anon;
grant execute on function public.set_instrument_isin(uuid, text) to authenticated;

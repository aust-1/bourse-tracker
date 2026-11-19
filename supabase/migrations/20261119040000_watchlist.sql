-- Liste de suivi : des titres suivis sans ordre ni alerte.
--
-- Un instrument n'était coté par le worker que s'il avait un ordre ou une alerte active. Un titre
-- « suivi » (`user_instruments.watched`) l'est aussi, et son historique de clôtures est rempli :
-- le compte peut regarder son cours, sa courbe et lui poser des alertes sans le détenir.

alter table public.user_instruments
  add column watched       boolean not null default false,
  add column watched_since timestamptz;

comment on column public.user_instruments.watched is
  'Titre de la liste de suivi : coté et historisé par le worker même sans ordre ni alerte';

create index user_instruments_watched_idx on public.user_instruments (instrument_id) where watched;

-- Le compte ne modifie que ce drapeau, sur un titre qu'il suit déjà (track_instrument).
create function public.set_instrument_watched(p_instrument uuid, p_watched boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.access_ok() then
    raise exception 'Connexion requise' using errcode = 'insufficient_privilege';
  end if;
  update public.user_instruments
     set watched = p_watched,
         watched_since = case when p_watched then coalesce(watched_since, now()) end
   where user_id = v_user and instrument_id = p_instrument;
  if not found then
    raise exception 'Titre inconnu' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.set_instrument_watched(uuid, boolean) from public, anon;
grant execute on function public.set_instrument_watched(uuid, boolean) to authenticated;

-- Double authentification (TOTP) imposée par la base.
--
-- Un compte qui a enrôlé un facteur TOTP vérifié doit présenter un jeton de niveau `aal2` :
-- avec un simple mot de passe (aal1), la clé anon et l'API REST ne donnent plus accès à rien.
-- Les politiques sont RESTRICTIVES : elles s'ajoutent (ET) aux politiques existantes.

create function public.aal_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors
        where user_id = auth.uid() and status = 'verified'
      );
$$;

comment on function public.aal_ok() is
  'Vrai si le jeton est aal2, ou si le compte n''a aucun facteur MFA vérifié.';

create policy orders_mfa on public.orders as restrictive for all to authenticated
  using ((select public.aal_ok())) with check ((select public.aal_ok()));
create policy alerts_mfa on public.alerts as restrictive for all to authenticated
  using ((select public.aal_ok())) with check ((select public.aal_ok()));
create policy settings_mfa on public.settings as restrictive for all to authenticated
  using ((select public.aal_ok())) with check ((select public.aal_ok()));
create policy alert_events_mfa on public.alert_events as restrictive for select to authenticated
  using ((select public.aal_ok()));
create policy instruments_mfa on public.instruments as restrictive for select to authenticated
  using ((select public.aal_ok()));
create policy quotes_mfa on public.quotes_latest as restrictive for select to authenticated
  using ((select public.aal_ok()));
create policy history_mfa on public.price_history as restrictive for select to authenticated
  using ((select public.aal_ok()));
create policy worker_status_mfa on public.worker_status as restrictive for select to authenticated
  using ((select public.aal_ok()));
create policy profiles_mfa on public.profiles as restrictive for select to authenticated
  using ((select public.aal_ok()));
create policy user_instruments_mfa on public.user_instruments as restrictive for select
  to authenticated using ((select public.aal_ok()));
create policy invitations_mfa on public.invitations as restrictive for all to authenticated
  using ((select public.aal_ok())) with check ((select public.aal_ok()));

-- l'administration passe aussi par le second facteur
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.aal_ok()
     and coalesce((select is_admin from public.profiles where user_id = auth.uid()), false);
$$;

-- suivre un instrument : même exigence
create or replace function public.track_instrument(
  p_symbol   text,
  p_name     text default null,
  p_exchange text default null
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
  if not public.aal_ok() then
    raise exception 'Double authentification requise' using errcode = 'insufficient_privilege';
  end if;

  select id into v_id from public.instruments where yahoo_symbol = p_symbol;
  if v_id is null then
    if p_name is null then
      return null;
    end if;
    insert into public.instruments (yahoo_symbol, name, exchange)
    values (p_symbol, p_name, p_exchange)
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

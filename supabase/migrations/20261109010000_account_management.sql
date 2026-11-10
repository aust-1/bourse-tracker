-- Gestion des comptes : suppression de son propre compte, désactivation par l'administrateur,
-- liste des comptes pour l'administrateur.

alter table public.profiles add column disabled_at timestamptz;

-- ---------------------------------------------------------------------------
-- Accès aux données : second facteur présenté (voir migration mfa) ET compte actif.
-- Un compte désactivé ne peut plus se connecter (banned_until) ; ce contrôle couvre en plus
-- le jeton d'accès encore valide au moment de la désactivation (une heure au plus).
-- ---------------------------------------------------------------------------
create function public.access_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.aal_ok()
     and not exists (
       select 1 from public.profiles where user_id = auth.uid() and disabled_at is not null
     );
$$;

alter policy orders_mfa on public.orders
  using ((select public.access_ok())) with check ((select public.access_ok()));
alter policy alerts_mfa on public.alerts
  using ((select public.access_ok())) with check ((select public.access_ok()));
alter policy settings_mfa on public.settings
  using ((select public.access_ok())) with check ((select public.access_ok()));
alter policy invitations_mfa on public.invitations
  using ((select public.access_ok())) with check ((select public.access_ok()));
alter policy alert_events_mfa on public.alert_events using ((select public.access_ok()));
alter policy instruments_mfa on public.instruments using ((select public.access_ok()));
alter policy quotes_mfa on public.quotes_latest using ((select public.access_ok()));
alter policy history_mfa on public.price_history using ((select public.access_ok()));
alter policy worker_status_mfa on public.worker_status using ((select public.access_ok()));
alter policy profiles_mfa on public.profiles using ((select public.access_ok()));
alter policy user_instruments_mfa on public.user_instruments using ((select public.access_ok()));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.access_ok()
     and coalesce((select is_admin from public.profiles where user_id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Suppression de son compte : toutes ses données partent en cascade (ordres, alertes, réglages,
-- historique d'alertes, invitations émises). Le dernier administrateur ne peut pas partir tant
-- que d'autres comptes existent : personne ne pourrait plus inviter ni désactiver.
-- ---------------------------------------------------------------------------
create function public.delete_my_account()
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
  if exists (select 1 from public.profiles where user_id = v_user and is_admin)
     and not exists (
       select 1 from public.profiles
       where is_admin and user_id <> v_user and disabled_at is null
     )
     and exists (select 1 from auth.users where id <> v_user) then
    raise exception 'Dernier administrateur : supprime ou promeus d''abord les autres comptes'
      using errcode = 'check_violation';
  end if;
  delete from auth.users where id = v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------
create function public.admin_list_accounts()
returns table (
  user_id         uuid,
  email           text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  is_admin        boolean,
  disabled_at     timestamptz,
  has_mfa         boolean,
  orders_count    bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = 'insufficient_privilege';
  end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at, p.is_admin, p.disabled_at,
           exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
           (select count(*) from public.orders o where o.user_id = u.id)
    from auth.users u
    join public.profiles p on p.user_id = u.id
    order by u.created_at;
end;
$$;

create function public.admin_set_disabled(p_user uuid, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = 'insufficient_privilege';
  end if;
  if p_user = auth.uid() then
    raise exception 'Impossible de désactiver son propre compte' using errcode = 'check_violation';
  end if;

  update public.profiles
     set disabled_at = case when p_disabled then coalesce(disabled_at, now()) end
   where user_id = p_user;
  if not found then
    raise exception 'Compte introuvable' using errcode = 'no_data_found';
  end if;

  -- connexion refusée par Supabase Auth (date lointaine : Auth ne sait pas lire 'infinity'),
  -- sessions en cours fermées
  update auth.users
     set banned_until = case when p_disabled then '2999-12-31'::timestamptz end
   where id = p_user;
  if p_disabled then
    delete from auth.sessions where user_id = p_user;
  end if;
end;
$$;

revoke execute on function public.delete_my_account(), public.admin_list_accounts(),
  public.admin_set_disabled(uuid, boolean) from public, anon;
grant execute on function public.delete_my_account(), public.admin_list_accounts(),
  public.admin_set_disabled(uuid, boolean) to authenticated;

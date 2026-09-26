-- Plusieurs utilisateurs (M11)
--
-- 1. Comptes sur invitation : un administrateur crée un lien, la base refuse toute inscription
--    sans code valide (trigger sur auth.users). Le premier compte d'une instance neuve en est
--    l'administrateur, sans invitation.
-- 2. Les instruments restent une donnée de référence commune (une seule cote à récupérer par
--    titre), mais chaque compte ne voit que ceux qu'il suit (`user_instruments`) : la liste des
--    titres d'un utilisateur ne doit pas être visible des autres.
-- 3. Les données déjà enregistrées (ordres, alertes, réglages, instruments) restent rattachées
--    au compte existant, qui devient administrateur.

-- ---------------------------------------------------------------------------
-- Profils et invitations
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  is_admin   boolean not null default false,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index profiles_invited_by_idx on public.profiles (invited_by);

create table public.invitations (
  id         uuid primary key default gen_random_uuid(),
  -- 122 bits aléatoires (uuid v4) : impossible à deviner
  code       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  note       text check (char_length(note) <= 100),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references auth.users (id) on delete set null,
  used_email text,
  used_at    timestamptz
);
create index invitations_created_by_idx on public.invitations (created_by);
create index invitations_used_by_idx on public.invitations (used_by);

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where user_id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Instruments suivis par chaque compte
-- ---------------------------------------------------------------------------
create table public.user_instruments (
  user_id       uuid not null references auth.users (id) on delete cascade,
  instrument_id uuid not null references public.instruments (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, instrument_id)
);
create index user_instruments_instrument_idx on public.user_instruments (instrument_id);

-- ---------------------------------------------------------------------------
-- Reprise de l'existant : le compte actuel (le plus ancien) devient administrateur et garde
-- tous les instruments déjà enregistrés ; chaque compte suit ceux de ses ordres et alertes.
-- ---------------------------------------------------------------------------
insert into public.profiles (user_id, is_admin)
select id, row_number() over (order by created_at, id) = 1
from auth.users;

insert into public.user_instruments (user_id, instrument_id)
select user_id, instrument_id from public.orders
union
select user_id, instrument_id from public.alerts
union
select p.user_id, i.id from public.instruments i cross join public.profiles p where p.is_admin;

-- ---------------------------------------------------------------------------
-- Inscription : premier compte = administrateur, sinon invitation obligatoire
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inviter uuid;
begin
  if not exists (select 1 from auth.users where id <> new.id) then
    insert into public.profiles (user_id, is_admin) values (new.id, true);
    return null;
  end if;

  -- le verrou de ligne de l'update empêche deux inscriptions avec le même code
  update public.invitations
     set used_by = new.id, used_email = new.email, used_at = now()
   where code = new.raw_user_meta_data ->> 'invite_code'
     and used_at is null
     and expires_at > now()
  returning created_by into v_inviter;

  if not found then
    raise exception 'Invitation invalide, expirée ou déjà utilisée'
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (user_id, invited_by) values (new.id, v_inviter);
  return null;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Vérification préalable pour la page d'inscription (message clair avant de créer le compte)
create function public.invitation_is_valid(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invitations
    where code = p_code and used_at is null and expires_at > now()
  );
$$;

-- ---------------------------------------------------------------------------
-- Suivre un instrument : le seul chemin pour en créer un ou y accéder
-- ---------------------------------------------------------------------------
-- Sans `p_name`, ne fait que rattacher un instrument déjà connu (renvoie null s'il est inconnu :
-- l'application le vérifie alors auprès de la source de prix et rappelle avec son nom).
create function public.track_instrument(
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.invitations      enable row level security;
alter table public.user_instruments enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_instruments_select on public.user_instruments for select to authenticated
  using (user_id = (select auth.uid()));

-- Les administrateurs gèrent les invitations ; une invitation utilisée n'est plus supprimable
create policy invitations_select on public.invitations for select to authenticated
  using ((select public.is_admin()));
create policy invitations_insert on public.invitations for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));
create policy invitations_delete on public.invitations for delete to authenticated
  using ((select public.is_admin()) and used_at is null);

-- Référence : on ne voit que les instruments suivis (et leurs cotes, et leur historique).
-- Realtime applique aussi ces règles : un compte ne reçoit que les cotes de ses titres.
drop policy instruments_select on public.instruments;
drop policy instruments_insert on public.instruments;
drop policy quotes_select on public.quotes_latest;
drop policy history_select on public.price_history;

create policy instruments_select on public.instruments for select to authenticated
  using (id in (select instrument_id from public.user_instruments where user_id = (select auth.uid())));
create policy quotes_select on public.quotes_latest for select to authenticated
  using (instrument_id in (select instrument_id from public.user_instruments where user_id = (select auth.uid())));
create policy history_select on public.price_history for select to authenticated
  using (instrument_id in (select instrument_id from public.user_instruments where user_id = (select auth.uid())));

-- Un ordre ou une alerte ne peut porter que sur un instrument suivi
drop policy orders_all on public.orders;
drop policy alerts_all on public.alerts;

create policy orders_all on public.orders for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and instrument_id in (select instrument_id from public.user_instruments where user_id = (select auth.uid()))
  );
create policy alerts_all on public.alerts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and instrument_id in (select instrument_id from public.user_instruments where user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------
revoke insert on public.instruments from authenticated;
-- les privilèges par défaut du schéma accordent tout aux nouvelles tables : on repart de zéro
revoke all on public.profiles, public.invitations, public.user_instruments from anon, authenticated;

grant select on public.profiles, public.user_instruments to authenticated;
grant select, delete on public.invitations to authenticated;
-- seule la note est choisie par l'administrateur : code, dates et usage sont fixés par la base
grant insert (note) on public.invitations to authenticated;

grant all on public.profiles, public.invitations, public.user_instruments to service_role;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.track_instrument(text, text, text) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.invitation_is_valid(text) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.track_instrument(text, text, text) to authenticated;
grant execute on function public.invitation_is_valid(text) to anon, authenticated;

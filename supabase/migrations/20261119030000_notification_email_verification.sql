-- Adresse email de notification confirmée, et messages de test limités.
--
-- L'adresse des notifications est libre (elle peut différer de celle du compte). Sans contrôle, un
-- compte pouvait faire envoyer des emails depuis le domaine de l'instance vers n'importe quelle
-- adresse (bouton « Envoyer un test », alertes, résumés), sans limite.
--
-- 1. `settings.email_verified` est calculé par la base : vrai si l'adresse est celle du compte, ou
--    si elle a été confirmée par un code reçu à cette adresse. Le worker n'écrit qu'à une adresse
--    confirmée ; un client ne peut pas forcer la valeur (déclencheur).
-- 2. Le code est envoyé par le worker (clé service_role) : il ne passe jamais par le navigateur,
--    sinon un compte pourrait « confirmer » une adresse qu'il ne lit pas.
-- 3. Un message de test par canal et par minute au plus.

-- ---------------------------------------------------------------------------
-- Confirmation de l'adresse
-- ---------------------------------------------------------------------------
create table public.notification_email_verifications (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  -- adresse à confirmer (ou confirmée)
  email           text not null,
  -- demande du compte, en attente d'envoi par le worker
  requested_at    timestamptz,
  sent_at         timestamptz,
  -- sha256 (hex) du code envoyé ; jamais lisible par le compte
  code_hash       text,
  code_expires_at timestamptz,
  attempts        integer not null default 0,
  verified_at     timestamptz
);

alter table public.notification_email_verifications enable row level security;
create policy notification_email_verifications_select on public.notification_email_verifications
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.notification_email_verifications from anon, authenticated;
-- le code haché n'est pas lisible
grant select (user_id, email, requested_at, sent_at, code_expires_at, verified_at)
  on public.notification_email_verifications to authenticated;
grant all on public.notification_email_verifications to service_role;

alter table public.settings add column email_verified boolean not null default false;
comment on column public.settings.email_verified is
  'Calculé par la base : adresse du compte, ou adresse confirmée par code. Seule une adresse confirmée reçoit des emails.';

-- Valeur de email_verified pour (compte, adresse)
create function public.notification_email_is_verified(p_user uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_email is null
      or exists (select 1 from auth.users u where u.id = p_user and lower(u.email) = lower(p_email))
      or exists (
        select 1 from public.notification_email_verifications v
        where v.user_id = p_user and lower(v.email) = lower(p_email) and v.verified_at is not null
      );
$$;
revoke execute on function public.notification_email_is_verified(uuid, text)
  from public, anon, authenticated;

create function public.settings_compute_email_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email_verified := public.notification_email_is_verified(new.user_id, new.email);
  return new;
end;
$$;
revoke execute on function public.settings_compute_email_verified() from public, anon, authenticated;

create trigger settings_email_verified
before insert or update on public.settings
for each row execute function public.settings_compute_email_verified();

-- Reprise de l'existant : les adresses déjà enregistrées sont conservées telles quelles (comptes
-- invités par l'administrateur) ; tout changement ultérieur passe par la confirmation.
insert into public.notification_email_verifications (user_id, email, verified_at)
select user_id, email, now() from public.settings where email is not null
on conflict (user_id) do nothing;
-- recalcul de toutes les lignes par le déclencheur
update public.settings set email_verified = email_verified;

-- Demande d'un code pour l'adresse enregistrée dans les réglages (envoyé par le worker).
create function public.request_notification_email_code()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_last  timestamptz;
begin
  if v_user is null or not public.access_ok() then
    raise exception 'Connexion requise' using errcode = 'insufficient_privilege';
  end if;
  select email into v_email from public.settings where user_id = v_user and not email_verified;
  if v_email is null then
    raise exception 'Aucune adresse à confirmer' using errcode = 'invalid_parameter_value';
  end if;
  select greatest(requested_at, sent_at) into v_last
  from public.notification_email_verifications where user_id = v_user;
  if v_last > now() - interval '2 minutes' then
    raise exception 'Un code vient d''être demandé : réessaie dans deux minutes'
      using errcode = 'check_violation';
  end if;
  insert into public.notification_email_verifications (user_id, email, requested_at)
  values (v_user, v_email, now())
  on conflict (user_id) do update
    set email = excluded.email, requested_at = now(), sent_at = null, code_hash = null,
        code_expires_at = null, attempts = 0, verified_at = null;
end;
$$;

-- Saisie du code reçu : 5 essais par code, valable 30 minutes. Vrai si l'adresse est confirmée.
create function public.confirm_notification_email(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v      public.notification_email_verifications%rowtype;
begin
  if v_user is null or not public.access_ok() then
    raise exception 'Connexion requise' using errcode = 'insufficient_privilege';
  end if;
  select * into v from public.notification_email_verifications where user_id = v_user for update;
  if v.code_hash is null
     or v.code_expires_at < now()
     or v.attempts >= 5
     or not exists (select 1 from public.settings s where s.user_id = v_user and lower(s.email) = lower(v.email)) then
    raise exception 'Code expiré ou épuisé : demande un nouveau code' using errcode = 'check_violation';
  end if;
  if encode(sha256(convert_to(btrim(p_code), 'UTF8')), 'hex') <> v.code_hash then
    update public.notification_email_verifications set attempts = attempts + 1 where user_id = v_user;
    return false;
  end if;
  update public.notification_email_verifications
     set verified_at = now(), code_hash = null, code_expires_at = null
   where user_id = v_user;
  -- recalcul par le déclencheur
  update public.settings set email_verified = true where user_id = v_user;
  return true;
end;
$$;

revoke execute on function public.request_notification_email_code(), public.confirm_notification_email(text)
  from public, anon;
grant execute on function public.request_notification_email_code(), public.confirm_notification_email(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Messages de test : un par canal et par minute
-- ---------------------------------------------------------------------------
create table public.notification_test_sends (
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, channel)
);
alter table public.notification_test_sends enable row level security;
revoke all on public.notification_test_sends from anon, authenticated;
grant all on public.notification_test_sends to service_role;

-- Réserve l'envoi d'un message de test ; faux si le dernier sur ce canal date de moins d'une minute.
create function public.claim_notification_test(p_channel text)
returns boolean
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
  insert into public.notification_test_sends (user_id, channel) values (v_user, p_channel)
  on conflict (user_id, channel) do update set sent_at = now()
    where public.notification_test_sends.sent_at < now() - interval '1 minute';
  return found;
end;
$$;
revoke execute on function public.claim_notification_test(text) from public, anon;
grant execute on function public.claim_notification_test(text) to authenticated;

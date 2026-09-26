begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- Jeu de données (rôle postgres, RLS contournée). Base vidée dans la transaction :
-- A est ainsi le premier compte de l'instance (annulé par le rollback final).
delete from auth.users;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local');

insert into public.invitations (id, code, created_by) values
  ('30000000-0000-0000-0000-000000000001', 'code-b', '00000000-0000-0000-0000-00000000000a'),
  ('30000000-0000-0000-0000-000000000002', 'code-expire', '00000000-0000-0000-0000-00000000000a');
update public.invitations set expires_at = now() - interval '1 minute' where code = 'code-expire';

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"invite_code":"code-b"}');

insert into public.instruments (id, yahoo_symbol, name, exchange) values
  ('10000000-0000-0000-0000-000000000001', 'TAP1.PA', 'Amundi MSCI World', 'PAR'),
  ('10000000-0000-0000-0000-000000000002', 'TAP2.PA', 'Lyxor CAC 40', 'PAR');
insert into public.user_instruments (user_id, instrument_id) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001');

insert into public.quotes_latest (instrument_id, price, prev_close, quoted_at) values
  ('10000000-0000-0000-0000-000000000001', 100, 99, now());

-- ---------------------------------------------------------------------------
-- Inscription sur invitation
-- ---------------------------------------------------------------------------
select is((select is_admin from public.profiles where user_id = '00000000-0000-0000-0000-00000000000a'),
  true, 'le premier compte est administrateur');
select is((select is_admin from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b'),
  false, 'un compte invité n''est pas administrateur');
select is((select invited_by from public.profiles where user_id = '00000000-0000-0000-0000-00000000000b'),
  '00000000-0000-0000-0000-00000000000a'::uuid, 'le profil garde qui a invité');
select is((select used_email from public.invitations where code = 'code-b'),
  'b@test.local', 'l''invitation est marquée utilisée');

select throws_ok(
  $$insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'c@test.local')$$,
  '23514', null, 'inscription sans invitation refusée');
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-00000000000c', 'c@test.local', '{"invite_code":"code-b"}')$$,
  '23514', null, 'invitation déjà utilisée refusée');
select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values ('00000000-0000-0000-0000-00000000000c', 'c@test.local', '{"invite_code":"code-expire"}')$$,
  '23514', null, 'invitation expirée refusée');

-- ---------------------------------------------------------------------------
-- Contraintes de structure
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.instruments (yahoo_symbol, name, currency) values ('AAPL', 'Apple', 'USD')$$,
  '23514', null, 'instrument hors EUR refusé');

select throws_ok(
  $$insert into public.orders (user_id, instrument_id, side, quantity, unit_price, executed_at)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'buy', 0, 10, now())$$,
  '23514', null, 'quantité nulle refusée');

select throws_ok(
  $$insert into public.alerts (user_id, instrument_id, type, threshold)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'price_above', -1)$$,
  '23514', null, 'seuil de prix négatif refusé');

select throws_ok(
  $$insert into public.alerts (user_id, instrument_id, type, threshold, channels)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'price_above', 10, '{sms}')$$,
  '23514', null, 'canal inconnu refusé');

select lives_ok(
  $$insert into public.alerts (user_id, instrument_id, type, threshold)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'day_change_down', -5)$$,
  'seuil négatif accepté pour une variation');

-- ---------------------------------------------------------------------------
-- Trigger anti vente à découvert
-- ---------------------------------------------------------------------------
insert into public.orders (id, user_id, instrument_id, side, quantity, unit_price, executed_at) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a',
   '10000000-0000-0000-0000-000000000001', 'buy', 10, 100, '2026-01-05 10:00+00');

select throws_ok(
  $$insert into public.orders (user_id, instrument_id, side, quantity, unit_price, executed_at)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'sell', 11, 100, '2026-01-06 10:00+00')$$,
  '23514', null, 'vente supérieure à la quantité détenue refusée');

select throws_ok(
  $$insert into public.orders (user_id, instrument_id, side, quantity, unit_price, executed_at)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'sell', 5, 100, '2026-01-04 10:00+00')$$,
  '23514', null, 'vente antérieure à l''achat refusée');

select lives_ok(
  $$insert into public.orders (id, user_id, instrument_id, side, quantity, unit_price, executed_at)
    values ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a',
            '10000000-0000-0000-0000-000000000001', 'sell', 10, 110, '2026-01-06 10:00+00')$$,
  'vente de toute la position acceptée');

select throws_ok(
  $$delete from public.orders where id = '20000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'suppression d''un achat couvrant une vente refusée');

select throws_ok(
  $$update public.orders set quantity = 5 where id = '20000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'réduction d''un achat sous les ventes refusée');

select lives_ok(
  $$delete from public.orders where id = '20000000-0000-0000-0000-000000000002'$$,
  'suppression de la vente acceptée');

-- ---------------------------------------------------------------------------
-- RLS : l'utilisateur B ne voit rien de A
-- ---------------------------------------------------------------------------
insert into public.settings (user_id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is((select count(*) from public.orders), 0::bigint, 'B ne voit aucun ordre de A');
select is((select count(*) from public.alerts), 0::bigint, 'B ne voit aucune alerte de A');
select is((select count(*) from public.settings), 0::bigint, 'B ne voit pas les réglages de A');
select is((select count(*) from public.instruments), 0::bigint, 'B ne voit pas les instruments suivis par A');
select is((select count(*) from public.quotes_latest), 0::bigint, 'B ne voit pas leurs cotes');
select is((select count(*) from public.invitations), 0::bigint, 'B ne voit pas les invitations');
select is((select count(*) from public.profiles), 1::bigint, 'B ne voit que son profil');

select throws_ok(
  $$insert into public.orders (user_id, instrument_id, side, quantity, unit_price, executed_at)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'buy', 1, 1, now())$$,
  '42501', null, 'B ne peut pas écrire un ordre au nom de A');

select throws_ok(
  $$insert into public.orders (instrument_id, side, quantity, unit_price, executed_at)
    values ('10000000-0000-0000-0000-000000000002', 'buy', 1, 1, now())$$,
  '42501', null, 'B ne peut pas passer d''ordre sur un instrument qu''il ne suit pas');

select throws_ok(
  $$insert into public.instruments (yahoo_symbol, name) values ('TAP3.PA', 'Direct')$$,
  '42501', null, 'un instrument ne se crée pas en direct');

select throws_ok(
  $$insert into public.invitations (note) values ('pirate')$$,
  '42501', null, 'B (non administrateur) ne crée pas d''invitation');

select throws_ok(
  $$update public.quotes_latest set price = 1$$,
  '42501', null, 'un utilisateur ne peut pas écrire les cotes');

-- Suivre un instrument
select is(public.track_instrument('INCONNU.PA'), null, 'symbole inconnu sans nom : rien n''est créé');
select is(public.track_instrument('TAP2.PA'), '10000000-0000-0000-0000-000000000002'::uuid,
  'suivre un instrument connu renvoie son id');
select is((select count(*) from public.instruments), 1::bigint, 'B voit l''instrument qu''il suit');
select lives_ok(
  $$insert into public.orders (instrument_id, side, quantity, unit_price, executed_at)
    values ('10000000-0000-0000-0000-000000000002', 'buy', 1, 1, now())$$,
  'B passe un ordre sur un instrument suivi');
select isnt(public.track_instrument('NEW.PA', 'Nouveau', 'PAR'), null, 'suivre un nouvel instrument le crée');

-- A (administrateur) voit ses données et gère les invitations
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*) from public.orders), 1::bigint, 'A voit son ordre restant');
select is((select count(*) from public.instruments), 1::bigint, 'A ne voit pas les instruments suivis par B');
select lives_ok($$insert into public.invitations (note) values ('Camille')$$, 'A crée une invitation');
delete from public.invitations where code = 'code-b';
select is((select count(*) from public.invitations where code = 'code-b'), 1::bigint,
  'une invitation utilisée n''est pas supprimable');

-- ---------------------------------------------------------------------------
-- anon : aucun accès, sauf la vérification d'un code d'invitation
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$select * from public.orders$$, '42501', null, 'anon ne lit pas les ordres');
select throws_ok($$select * from public.quotes_latest$$, '42501', null, 'anon ne lit pas les cotes');
select is(public.invitation_is_valid('code-expire'), false, 'anon vérifie un code d''invitation');

select * from finish();
rollback;

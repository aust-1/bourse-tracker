begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

delete from auth.users;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.invitations (code, created_by) values ('code-b', '00000000-0000-0000-0000-00000000000a');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"invite_code":"code-b"}');
insert into public.instruments (id, yahoo_symbol, name, exchange) values
  ('10000000-0000-0000-0000-000000000001', 'TAP1.PA', 'Suivi', 'PAR'),
  ('10000000-0000-0000-0000-000000000002', 'TAP2.PA', 'Inconnu', 'PAR');
insert into public.user_instruments (user_id, instrument_id) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok($$select public.set_instrument_watched('10000000-0000-0000-0000-000000000001', true)$$,
  'A ajoute un titre suivi à sa liste');
select is((select watched from public.user_instruments), true, 'A voit le titre dans sa liste');
select isnt((select watched_since from public.user_instruments), null, 'date d''ajout notée');
select throws_ok($$select public.set_instrument_watched('10000000-0000-0000-0000-000000000002', true)$$,
  'P0002', null, 'un titre que A ne suit pas (track_instrument) est refusé');
select throws_ok($$update public.user_instruments set watched = false$$, '42501', null,
  'pas d''écriture directe dans user_instruments');

reset role;
select is((select watched from public.user_instruments where user_id = '00000000-0000-0000-0000-00000000000b'),
  false, 'la liste de B n''est pas touchée');

select * from finish();
rollback;

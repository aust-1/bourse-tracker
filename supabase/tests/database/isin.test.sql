begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

delete from auth.users;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.invitations (code, created_by) values ('code-b', '00000000-0000-0000-0000-00000000000a');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"invite_code":"code-b"}');
insert into public.instruments (id, yahoo_symbol, name, exchange) values
  ('10000000-0000-0000-0000-000000000001', 'TAP1.PA', 'Suivi', 'PAR'),
  ('10000000-0000-0000-0000-000000000002', 'TAP2.PA', 'Non suivi', 'PAR');
insert into public.user_instruments (user_id, instrument_id) values
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select public.set_instrument_isin('10000000-0000-0000-0000-000000000001', 'pas-un-isin')$$,
  '23514', null, 'format invalide refusé');
select lives_ok($$select public.set_instrument_isin('10000000-0000-0000-0000-000000000001', 'FR0000120271')$$,
  'B renseigne l''ISIN d''un titre suivi');
select throws_ok($$select public.set_instrument_isin('10000000-0000-0000-0000-000000000001', 'DE0007164600')$$,
  '42501', null, 'B ne peut pas le modifier ensuite');
select throws_ok($$select public.set_instrument_isin('10000000-0000-0000-0000-000000000002', 'FR0000120271')$$,
  '42501', null, 'titre non suivi refusé');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.set_instrument_isin('10000000-0000-0000-0000-000000000001', 'DE0007164600')$$,
  'l''administrateur peut le corriger');

select * from finish();
rollback;

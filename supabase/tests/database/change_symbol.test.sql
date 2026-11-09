begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

delete from auth.users;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.invitations (code, created_by) values ('code-b', '00000000-0000-0000-0000-00000000000a');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"invite_code":"code-b"}');
insert into public.instruments (id, yahoo_symbol, name, exchange, isin) values
  ('10000000-0000-0000-0000-000000000001', 'OLD.PA', 'Ancien', 'PAR', 'FR0000120271'),
  ('10000000-0000-0000-0000-000000000002', 'NEW.PA', 'Nouveau', 'PAR', 'FR0000120271'),
  ('10000000-0000-0000-0000-000000000003', 'AUTRE.PA', 'Autre', 'PAR', 'DE0007164600');
insert into public.user_instruments (user_id, instrument_id) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000002');
-- B a acheté sur NEW et vendu sur NEW ; A a acheté sur OLD
insert into public.orders (user_id, instrument_id, side, quantity, unit_price, executed_at) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'buy', 5, 10, '2026-01-05 10:00+01'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000002', 'buy', 3, 10, '2026-01-05 10:00+01'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000002', 'sell', 2, 11, '2026-01-06 10:00+01');
insert into public.price_history (instrument_id, date, close) values
  ('10000000-0000-0000-0000-000000000001', '2026-01-05', 10),
  ('10000000-0000-0000-0000-000000000002', '2026-01-05', 99),
  ('10000000-0000-0000-0000-000000000002', '2026-01-06', 11);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select public.admin_change_symbol('10000000-0000-0000-0000-000000000001', 'X.PA')$$,
  '42501', null, 'réservé à l''administrateur');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.admin_change_symbol('10000000-0000-0000-0000-000000000001', 'AUTRE.PA')$$,
  '23505', null, 'symbole d''un titre d''un autre ISIN : refusé');
select lives_ok($$select public.admin_change_symbol('10000000-0000-0000-0000-000000000001', 'NEW.PA')$$,
  'même ISIN : fusion');

reset role;
select is((select yahoo_symbol from public.instruments where id = '10000000-0000-0000-0000-000000000001'),
  'NEW.PA', 'l''instrument conservé prend le nouveau symbole');
select is((select count(*) from public.orders where instrument_id = '10000000-0000-0000-0000-000000000001'),
  3::bigint, 'tous les ordres rattachés (achat et vente déplacés ensemble)');
select is((select count(*) from public.user_instruments where instrument_id = '10000000-0000-0000-0000-000000000001'),
  2::bigint, 'les deux comptes suivent le titre fusionné');
select is((select array_agg(close order by date) from public.price_history
           where instrument_id = '10000000-0000-0000-0000-000000000001'),
  array[10, 11]::numeric[], 'clôtures existantes gardées, manquantes reprises');

select * from finish();
rollback;

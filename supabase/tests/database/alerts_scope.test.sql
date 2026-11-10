begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

delete from auth.users;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.instruments (id, yahoo_symbol, name, exchange) values
  ('10000000-0000-0000-0000-000000000001', 'TAP1.PA', 'Suivi', 'PAR');
insert into public.user_instruments (user_id, instrument_id) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok($$insert into public.alerts (type, threshold, note, rearm_minutes)
  values ('portfolio_value_below', 10000, 'filet de sécurité', 1440)$$,
  'alerte de portefeuille sans instrument');
select throws_ok($$insert into public.alerts (instrument_id, type, threshold)
  values ('10000000-0000-0000-0000-000000000001', 'portfolio_value_below', 10000)$$,
  '23514', null, 'alerte de portefeuille avec instrument : refusée');
select throws_ok($$insert into public.alerts (type, threshold) values ('price_above', 10)$$,
  '23514', null, 'alerte de cours sans instrument : refusée');
select throws_ok($$insert into public.alerts (instrument_id, type, threshold, rearm_minutes)
  values ('10000000-0000-0000-0000-000000000001', 'drawdown_from_high', -10, 1)$$,
  '23514', null, 'délai de réarmement trop court refusé');

select * from finish();
rollback;

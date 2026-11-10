begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

delete from auth.users;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.invitations (code, created_by) values ('code-b', '00000000-0000-0000-0000-00000000000a');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"invite_code":"code-b"}');
insert into public.instruments (id, yahoo_symbol, name, exchange) values
  ('10000000-0000-0000-0000-000000000001', 'TAP1.PA', 'Split', 'PAR');
insert into public.user_instruments (user_id, instrument_id) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001');

set local role authenticated;
-- B (non administrateur) ne peut pas saisir de split
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.splits (instrument_id, effective_on, ratio_from, ratio_to)
    values ('10000000-0000-0000-0000-000000000001', '2026-06-01', 1, 10)$$,
  '42501', null, 'split refusé à un non-administrateur');

-- A (administrateur)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into public.orders (instrument_id, side, quantity, unit_price, executed_at)
values ('10000000-0000-0000-0000-000000000001', 'buy', 10, 500, '2026-05-04 10:00+02');

-- sans split, vendre 50 titres est un découvert
select throws_ok(
  $$insert into public.orders (instrument_id, side, quantity, unit_price, executed_at)
    values ('10000000-0000-0000-0000-000000000001', 'sell', 50, 50, '2026-06-02 10:00+02')$$,
  '23514', null, 'vente de 50 sans split : découvert');

select lives_ok(
  $$insert into public.splits (instrument_id, effective_on, ratio_from, ratio_to)
    values ('10000000-0000-0000-0000-000000000001', '2026-06-01', 1, 10)$$,
  'division par 10 saisie par l''administrateur');
select is(public.split_factor('10000000-0000-0000-0000-000000000001', '2026-05-04 10:00+02'), 10::numeric,
  'facteur 10 avant la date d''effet');

-- après division : 10 titres en sont devenus 100
select lives_ok(
  $$insert into public.orders (instrument_id, side, quantity, unit_price, executed_at)
    values ('10000000-0000-0000-0000-000000000001', 'sell', 50, 50, '2026-06-02 10:00+02')$$,
  'vente de 50 après la division par 10');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*) from public.splits), 1::bigint, 'B voit le split d''un titre qu''il suit');

select * from finish();
rollback;

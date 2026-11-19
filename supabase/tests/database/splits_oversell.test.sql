begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- A : administrateur ; B : invité qui vend des titres « d'après » une division
delete from auth.users;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.invitations (code, created_by) values ('code-b', '00000000-0000-0000-0000-00000000000a');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"invite_code":"code-b"}');
insert into public.instruments (id, yahoo_symbol, name, exchange) values
  ('10000000-0000-0000-0000-000000000001', 'TAP1.PA', 'Split', 'PAR'),
  ('10000000-0000-0000-0000-000000000002', 'TAP2.PA', 'Autre', 'PAR');
insert into public.user_instruments (user_id, instrument_id) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001');

-- division 1 → 10 au 01/06 ; B achète 10 titres en mai, en vend 50 en juillet
insert into public.splits (id, instrument_id, effective_on, ratio_from, ratio_to) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-06-01', 1, 10);
insert into public.orders (user_id, instrument_id, side, quantity, unit_price, executed_at) values
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 'buy', 10, 500, '2026-05-04 10:00+02'),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 'sell', 50, 50, '2026-07-02 10:00+02');

-- l'administrateur ne voit pas les ordres de B, mais la base les vérifie
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*) from public.orders), 0::bigint, 'l''administrateur ne lit pas les ordres de B');
select throws_ok(
  $$delete from public.splits where id = '60000000-0000-0000-0000-000000000001'$$,
  '23514', 'Division refusée : une vente déjà enregistrée dépasserait la quantité détenue dans un portefeuille',
  'suppression refusée : la vente de 50 dépasserait les 10 titres d''avant division');
select is((select count(*) from public.splits), 1::bigint, 'la division est conservée');

-- un regroupement ultérieur (10 → 1 au 01/08) garde la position positive : accepté
select lives_ok(
  $$insert into public.splits (instrument_id, effective_on, ratio_from, ratio_to)
    values ('10000000-0000-0000-0000-000000000001', '2026-08-01', 10, 1)$$,
  'regroupement sans effet sur le découvert accepté');

-- titre sans vente concernée : suppression libre
insert into public.splits (id, instrument_id, effective_on, ratio_from, ratio_to) values
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '2026-06-01', 1, 2);
select lives_ok(
  $$delete from public.splits where id = '60000000-0000-0000-0000-000000000002'$$,
  'suppression d''une division sans conséquence acceptée');

-- changer la date d'effet après la vente (service) : refusé aussi
reset role;
select throws_ok(
  $$update public.splits set effective_on = '2026-07-15' where id = '60000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'déplacer la division après la vente est refusé');

-- position de B : 10 × 10 − 50 = 50 titres, regroupés 10 → 1 en août : 5
select is(
  (select sum(case side when 'buy' then quantity else -quantity end * public.split_factor(instrument_id, executed_at))
     from public.orders where user_id = '00000000-0000-0000-0000-00000000000b'
       and instrument_id = '10000000-0000-0000-0000-000000000001'),
  5::numeric, 'B détient 5 titres après la division puis le regroupement');

select * from finish();
rollback;

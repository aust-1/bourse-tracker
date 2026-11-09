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
  ('10000000-0000-0000-0000-000000000002', 'TAP2.PA', 'Non suivi', 'PAR');
insert into public.user_instruments (user_id, instrument_id) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.cash_movements (portfolio_id, kind, amount, occurred_on)
    select id, 'deposit', 1000, '2026-01-02' from public.portfolios$$,
  'versement enregistré');
select throws_ok(
  $$insert into public.cash_movements (portfolio_id, kind, amount, occurred_on)
    select id, 'dividend', 10, '2026-01-02' from public.portfolios$$,
  '23514', null, 'dividende sans titre refusé');
select throws_ok(
  $$insert into public.cash_movements (portfolio_id, kind, amount, occurred_on)
    select id, 'deposit', -5, '2026-01-02' from public.portfolios$$,
  '23514', null, 'montant négatif refusé');
select lives_ok(
  $$insert into public.cash_movements (portfolio_id, kind, amount, instrument_id, occurred_on)
    select id, 'dividend', 12.5, '10000000-0000-0000-0000-000000000001', '2026-03-02' from public.portfolios$$,
  'dividende d''un titre suivi');
select throws_ok(
  $$insert into public.cash_movements (portfolio_id, kind, amount, instrument_id, occurred_on)
    select id, 'dividend', 1, '10000000-0000-0000-0000-000000000002', '2026-03-02' from public.portfolios$$,
  '42501', null, 'dividende d''un titre non suivi refusé');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*) from public.cash_movements), 0::bigint, 'B ne voit pas les mouvements de A');

select * from finish();
rollback;

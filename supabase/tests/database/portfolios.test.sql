begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

delete from auth.users;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.invitations (code, created_by) values ('code-b', '00000000-0000-0000-0000-00000000000a');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"invite_code":"code-b"}');
insert into public.instruments (id, yahoo_symbol, name, exchange) values
  ('10000000-0000-0000-0000-000000000001', 'TAP1.PA', 'Amundi MSCI World', 'PAR');
insert into public.user_instruments (user_id, instrument_id) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001');

select is((select count(*) from public.portfolios where name = 'PEA'), 2::bigint,
  'chaque nouveau compte reçoit un portefeuille PEA');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

insert into public.portfolios (id, name, kind, created_at) values
  ('50000000-0000-0000-0000-000000000002', 'CTO', 'cto', now() + interval '1 minute');
select is((select count(*) from public.portfolios), 2::bigint, 'A voit ses 2 portefeuilles, pas ceux de B');

-- ordre sans portefeuille : le plus ancien (PEA)
insert into public.orders (instrument_id, side, quantity, unit_price, executed_at)
values ('10000000-0000-0000-0000-000000000001', 'buy', 10, 100, '2026-01-05 10:00+01');
select is((select p.name from public.orders o join public.portfolios p on p.id = o.portfolio_id),
  'PEA', 'portefeuille par défaut : le plus ancien du compte');

-- vente sur le CTO de titres détenus sur le PEA : refusée
select throws_ok(
  $$insert into public.orders (portfolio_id, instrument_id, side, quantity, unit_price, executed_at)
    values ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'sell', 1, 100, '2026-01-06 10:00+01')$$,
  '23514', null, 'vente à découvert contrôlée par portefeuille');
select lives_ok(
  $$insert into public.orders (instrument_id, side, quantity, unit_price, executed_at)
    values ('10000000-0000-0000-0000-000000000001', 'sell', 4, 110, '2026-01-06 10:00+01')$$,
  'vente sur le PEA qui détient les titres');

-- déplacer un achat vers le CTO laisserait la vente du PEA à découvert
select throws_ok(
  $$update public.orders set portfolio_id = '50000000-0000-0000-0000-000000000002' where side = 'buy'$$,
  '23514', null, 'déplacement d''un achat vérifié sur le portefeuille d''origine');

-- portefeuille d'un autre compte : refusé (clé étrangère composite)
reset role;
select throws_ok(
  $$insert into public.orders (user_id, portfolio_id, instrument_id, side, quantity, unit_price, executed_at)
    select '00000000-0000-0000-0000-00000000000a', id, '10000000-0000-0000-0000-000000000001', 'buy', 1, 1, now()
    from public.portfolios where user_id = '00000000-0000-0000-0000-00000000000b'$$,
  '23503', null, 'ordre rattaché au portefeuille d''un autre compte refusé');

-- suppression d'un portefeuille : ses ordres partent avec lui
delete from public.portfolios where name = 'PEA' and user_id = '00000000-0000-0000-0000-00000000000a';
select is((select count(*) from public.orders), 0::bigint, 'ordres supprimés avec leur portefeuille');

select * from finish();
rollback;

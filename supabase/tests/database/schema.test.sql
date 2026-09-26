begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Jeu de données (rôle postgres, RLS contournée)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

insert into public.instruments (id, yahoo_symbol, name, exchange) values
  ('10000000-0000-0000-0000-000000000001', 'TAP1.PA', 'Amundi MSCI World', 'PAR');

insert into public.quotes_latest (instrument_id, price, prev_close, quoted_at) values
  ('10000000-0000-0000-0000-000000000001', 100, 99, now());

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
select is((select count(*) from public.instruments where yahoo_symbol = 'TAP1.PA'), 1::bigint, 'les instruments sont partagés');

select throws_ok(
  $$insert into public.orders (user_id, instrument_id, side, quantity, unit_price, executed_at)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'buy', 1, 1, now())$$,
  '42501', null, 'B ne peut pas écrire un ordre au nom de A');

select throws_ok(
  $$update public.quotes_latest set price = 1$$,
  '42501', null, 'un utilisateur ne peut pas écrire les cotes');

-- A voit ses données
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*) from public.orders), 1::bigint, 'A voit son ordre restant');

-- ---------------------------------------------------------------------------
-- anon : aucun accès
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$select * from public.orders$$, '42501', null, 'anon ne lit pas les ordres');
select throws_ok($$select * from public.quotes_latest$$, '42501', null, 'anon ne lit pas les cotes');

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

delete from auth.users;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.invitations (code, created_by) values
  ('code-b', '00000000-0000-0000-0000-00000000000a'),
  ('code-c', '00000000-0000-0000-0000-00000000000a');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"invite_code":"code-b"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local', '{"invite_code":"code-c"}');
insert into public.instruments (id, yahoo_symbol, name, exchange) values
  ('10000000-0000-0000-0000-000000000001', 'TAP1.PA', 'Amundi MSCI World', 'PAR');
insert into public.user_instruments (user_id, instrument_id) values
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001');
insert into public.orders (user_id, instrument_id, side, quantity, unit_price, executed_at) values
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 'buy', 1, 10, now()),
  ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001', 'buy', 2, 10, now());

set local role authenticated;

-- B (non administrateur) : pas d'accès à l'administration
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select * from public.admin_list_accounts()$$, '42501', null,
  'liste des comptes refusée à un non-administrateur');
select throws_ok($$select public.admin_set_disabled('00000000-0000-0000-0000-00000000000c', true)$$,
  '42501', null, 'désactivation refusée à un non-administrateur');

-- A (administrateur)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*) from public.admin_list_accounts()), 3::bigint, 'l''administrateur voit les 3 comptes');
select is((select orders_count from public.admin_list_accounts() where email = 'c@test.local'), 1::bigint,
  'nombre d''ordres par compte');
select throws_ok($$select public.admin_set_disabled('00000000-0000-0000-0000-00000000000a', true)$$,
  '23514', null, 'pas de désactivation de son propre compte');
select lives_ok($$select public.admin_set_disabled('00000000-0000-0000-0000-00000000000c', true)$$,
  'désactivation de C');
select throws_ok($$select public.delete_my_account()$$, '23514', null,
  'le dernier administrateur ne peut pas supprimer son compte');

reset role;
select isnt((select banned_until from auth.users where email = 'c@test.local'), null,
  'C est banni de Supabase Auth');

-- C désactivé : plus aucune donnée, même avec un jeton encore valide
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*) from public.orders), 0::bigint, 'compte désactivé : ordres invisibles');

-- réactivation
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select public.admin_set_disabled('00000000-0000-0000-0000-00000000000c', false)$$,
  'réactivation de C');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*) from public.orders), 1::bigint, 'compte réactivé : ordres visibles');

-- B supprime son compte : ses données partent avec lui
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$select public.delete_my_account()$$, 'B supprime son compte');
reset role;
select is((select count(*) from public.orders where user_id = '00000000-0000-0000-0000-00000000000b'),
  0::bigint, 'les ordres de B sont supprimés');

select * from finish();
rollback;

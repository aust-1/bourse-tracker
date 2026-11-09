begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

delete from auth.users;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.instruments (id, yahoo_symbol, name, exchange) values
  ('10000000-0000-0000-0000-000000000001', 'TAP1.PA', 'Amundi MSCI World', 'PAR');
insert into public.user_instruments (user_id, instrument_id) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001');
insert into public.orders (user_id, instrument_id, side, quantity, unit_price, executed_at) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'buy', 1, 10, now());

-- sans facteur : un jeton aal1 suffit
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
select is((select count(*) from public.orders), 1::bigint, 'sans MFA : aal1 lit ses ordres');

-- facteur TOTP vérifié : aal1 ne voit plus rien
reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'totp',
        'totp', 'verified', now(), now(), 'secret');

set local role authenticated;
select is((select count(*) from public.orders), 0::bigint, 'MFA + aal1 : ordres invisibles');
select is((select count(*) from public.instruments), 0::bigint, 'MFA + aal1 : instruments invisibles');
select is(public.is_admin(), false, 'MFA + aal1 : pas administrateur');
select throws_ok(
  $$insert into public.settings (email) values ('x@test.local')$$,
  '42501', null, 'MFA + aal1 : écriture refusée');
select throws_ok($$select public.track_instrument('TAP1.PA')$$, '42501', null,
  'MFA + aal1 : suivi d''instrument refusé');

-- même compte en aal2 : accès rétabli
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select is((select count(*) from public.orders), 1::bigint, 'MFA + aal2 : ordres visibles');

select * from finish();
rollback;

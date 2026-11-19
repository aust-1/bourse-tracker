begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

delete from auth.users;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$select public.track_instrument('LONG.PA', repeat('x', 121), 'PAR')$$,
  '22023', null, 'nom de plus de 120 caractères refusé');
select throws_ok(
  $$select public.track_instrument('AB CD;--', 'Nom', 'PAR')$$,
  '22023', null, 'symbole hors du format Yahoo refusé');
select throws_ok(
  $$select public.track_instrument('EXCH.PA', 'Nom', repeat('p', 21))$$,
  '22023', null, 'place trop longue refusée');
select is(public.track_instrument('BLANK.PA', '   '), null, 'nom vide : rien n''est créé');
select isnt(public.track_instrument('OK.PA', '  Air Liquide  ', 'PAR'), null, 'nom raisonnable accepté');

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

delete from auth.users;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- adresse du compte : confirmée d'office
insert into public.settings (email) values ('A@test.local');
select is((select email_verified from public.settings), true, 'adresse du compte : confirmée');

-- autre adresse : non confirmée, et le compte ne peut pas forcer la valeur
update public.settings set email = 'tiers@example.com', email_verified = true;
select is((select email_verified from public.settings), false, 'autre adresse : non confirmée, valeur forcée ignorée');

select lives_ok($$select public.request_notification_email_code()$$, 'demande d''un code');
select throws_ok($$select public.request_notification_email_code()$$, '23514', null,
  'nouvelle demande refusée pendant deux minutes');
select throws_ok($$select code_hash from public.notification_email_verifications$$, '42501', null,
  'le code haché n''est pas lisible par le compte');
select throws_ok($$select public.confirm_notification_email('123456')$$, '23514', null,
  'pas encore de code envoyé : confirmation impossible');

-- le worker (service) enregistre le code envoyé : 123456
reset role;
update public.notification_email_verifications
   set code_hash = encode(sha256(convert_to('123456', 'UTF8')), 'hex'),
       code_expires_at = now() + interval '30 minutes', requested_at = null, sent_at = now();
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is(public.confirm_notification_email('000000'), false, 'mauvais code refusé');
select is((select email_verified from public.settings), false, 'toujours non confirmée');
select is(public.confirm_notification_email(' 123456 '), true, 'bon code accepté');
select is((select email_verified from public.settings), true, 'adresse confirmée');

-- changer d'adresse fait repartir de zéro
update public.settings set email = 'autre@example.com';
select is((select email_verified from public.settings), false, 'nouvelle adresse : à confirmer');

-- messages de test : un par canal et par minute
select is(public.claim_notification_test('email'), true, 'premier test accepté');
select is(public.claim_notification_test('email'), false, 'second test dans la minute refusé');
select is(public.claim_notification_test('discord'), true, 'autre canal : accepté');

select * from finish();
rollback;

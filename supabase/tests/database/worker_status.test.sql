begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- A : premier compte (administrateur) ; B : invité
delete from auth.users;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'a@test.local');
insert into public.invitations (code, created_by) values ('code-b', '00000000-0000-0000-0000-00000000000a');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"invite_code":"code-b"}');

update public.worker_status
   set last_error = 'erreur du worker', failed = '[{"symbol":"TAP1.PA","error":"HTTP 404"}]'
 where id = 1;

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*) from public.worker_status), 0::bigint,
  'un compte non administrateur ne lit pas l''état du worker');
select is((select count(*) from public.worker_status where failed::text like '%TAP1.PA%'), 0::bigint,
  'les symboles en échec des autres comptes restent invisibles');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*) from public.worker_status), 1::bigint,
  'l''administrateur lit l''état du worker');
select is((select last_error from public.worker_status), 'erreur du worker',
  'l''administrateur voit la dernière erreur');

reset role;
select * from finish();
rollback;

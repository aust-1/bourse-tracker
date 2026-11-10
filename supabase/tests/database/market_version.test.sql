begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into public.instruments (id, yahoo_symbol, name, exchange) values
  ('10000000-0000-0000-0000-0000000000f1', 'VER1.PA', 'Version', 'PAR');

create temp table v0 as select version from public.market_data_version;

insert into public.price_history (instrument_id, date, close)
select '10000000-0000-0000-0000-0000000000f1', d::date, 100
from generate_series('2026-01-01'::date, '2026-01-31'::date, interval '1 day') d;
select is((select version from public.market_data_version) - (select version from v0), 1::bigint,
  'une insertion de 31 clôtures : version + 1');

update public.price_history set close = 101 where instrument_id = '10000000-0000-0000-0000-0000000000f1';
select is((select version from public.market_data_version) - (select version from v0), 2::bigint,
  'mise à jour : version + 1');

insert into public.splits (instrument_id, effective_on, ratio_from, ratio_to)
values ('10000000-0000-0000-0000-0000000000f1', '2026-01-15', 1, 2);
select is((select version from public.market_data_version) - (select version from v0), 3::bigint,
  'split : version + 1');

select * from finish();
rollback;

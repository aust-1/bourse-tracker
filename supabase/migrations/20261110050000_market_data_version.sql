-- Version des données de marché : incrémentée à chaque écriture dans price_history ou splits.
-- Le site garde les clôtures en cache tant que la version ne change pas (un seul petit select
-- au lieu de dizaines de pages de clôtures à chaque affichage de l'historique).

create table public.market_data_version (
  id         smallint primary key default 1 check (id = 1),
  version    bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.market_data_version (id) values (1);

alter table public.market_data_version enable row level security;
create policy market_data_version_select on public.market_data_version for select
  to authenticated using (true);
grant select on public.market_data_version to authenticated;
grant all on public.market_data_version to service_role;

create function public.bump_market_data_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.market_data_version set version = version + 1, updated_at = now() where id = 1;
  return null;
end;
$$;

-- une fois par instruction : un upsert de 1 000 clôtures n'incrémente qu'une fois
create trigger price_history_bump_version
after insert or update or delete on public.price_history
for each statement execute function public.bump_market_data_version();

create trigger splits_bump_version
after insert or update or delete on public.splits
for each statement execute function public.bump_market_data_version();

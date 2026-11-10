-- Mouvements d'espèces d'un portefeuille : versements, retraits, dividendes, frais (droits de
-- garde…). Avec les ordres, ils donnent le solde de liquidités et le suivi du plafond du PEA.

create type public.cash_kind as enum ('deposit', 'withdrawal', 'dividend', 'fee');

create table public.cash_movements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  portfolio_id  uuid not null,
  kind          public.cash_kind not null,
  -- montant net, toujours positif : le sens vient du type
  amount        numeric(18, 4) not null check (amount > 0),
  -- titre qui a versé le dividende (obligatoire pour un dividende, interdit sinon)
  instrument_id uuid references public.instruments (id),
  occurred_on   date not null,
  note          text check (char_length(note) <= 200),
  created_at    timestamptz not null default now(),
  constraint cash_movements_portfolio_fk foreign key (portfolio_id, user_id)
    references public.portfolios (id, user_id) on delete cascade,
  constraint cash_movements_instrument check ((kind = 'dividend') = (instrument_id is not null))
);

create index cash_movements_portfolio_idx on public.cash_movements (portfolio_id, occurred_on);
create index cash_movements_user_idx on public.cash_movements (user_id, occurred_on);
create index cash_movements_instrument_idx on public.cash_movements (instrument_id);

alter table public.cash_movements enable row level security;
create policy cash_movements_all on public.cash_movements for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      instrument_id is null
      or instrument_id in (
        select instrument_id from public.user_instruments where user_id = (select auth.uid())
      )
    )
  );
create policy cash_movements_access on public.cash_movements as restrictive for all
  to authenticated using ((select public.access_ok())) with check ((select public.access_ok()));
grant select, insert, update, delete on public.cash_movements to authenticated;
grant all on public.cash_movements to service_role;

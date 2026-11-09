-- Supervision : état du worker et des cotes, lisible par l'administrateur depuis le site.

alter table public.worker_status
  add column last_poll_at timestamptz,
  add column failed jsonb not null default '[]'::jsonb;

comment on column public.worker_status.last_poll_at is
  'Dernier cycle de cotation (séance ou démarrage)';
comment on column public.worker_status.failed is
  'Échecs du dernier cycle de cotation : [{symbol, error}]';

-- Tous les instruments suivis par au moins un compte (la RLS limite sinon chacun aux siens).
create function public.admin_supervision()
returns table (
  instrument_id   uuid,
  yahoo_symbol    text,
  name            text,
  price           numeric,
  quoted_at       timestamptz,
  fetched_at      timestamptz,
  last_close_date date,
  followers       bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs' using errcode = 'insufficient_privilege';
  end if;
  return query
    select i.id, i.yahoo_symbol, i.name, q.price, q.quoted_at, q.fetched_at,
           (select max(h.date) from public.price_history h where h.instrument_id = i.id),
           (select count(*) from public.user_instruments ui where ui.instrument_id = i.id)
    from public.instruments i
    left join public.quotes_latest q on q.instrument_id = i.id
    where exists (select 1 from public.user_instruments ui where ui.instrument_id = i.id)
    order by i.name;
end;
$$;

revoke execute on function public.admin_supervision() from public, anon;
grant execute on function public.admin_supervision() to authenticated;

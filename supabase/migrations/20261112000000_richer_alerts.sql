-- Alertes plus riches :
-- - baisse depuis le plus haut (le plus haut est suivi par le worker dans reference_value) ;
-- - alertes sur le portefeuille entier (valeur, variation du jour) : sans instrument ;
-- - réarmement automatique après un délai, une fois la condition redevenue fausse ;
-- - note libre, rappelée dans la notification.

alter type public.alert_type add value 'drawdown_from_high';
alter type public.alert_type add value 'portfolio_value_above';
alter type public.alert_type add value 'portfolio_value_below';
alter type public.alert_type add value 'portfolio_day_change_up';
alter type public.alert_type add value 'portfolio_day_change_down';

alter table public.alerts
  alter column instrument_id drop not null,
  add column note text check (char_length(note) <= 200),
  add column rearm_minutes integer check (rearm_minutes is null or rearm_minutes between 5 and 43200),
  -- plus haut observé depuis la création ou le dernier réarmement (baisse depuis le plus haut)
  add column reference_value numeric(18, 6);

-- une alerte de portefeuille n'a pas d'instrument ; les autres en ont un
alter table public.alerts add constraint alerts_scope check (
  (type::text like 'portfolio\_%') = (instrument_id is null)
);

drop policy alerts_all on public.alerts;
create policy alerts_all on public.alerts for all to authenticated
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

create index alerts_rearm_idx on public.alerts (last_triggered_at)
  where status = 'triggered' and rearm_minutes is not null;

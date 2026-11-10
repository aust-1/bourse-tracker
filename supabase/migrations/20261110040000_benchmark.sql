-- Indice de référence de la page Historique (symbole Yahoo : ^FCHI pour le CAC 40, CW8.PA…).
alter table public.settings
  add column benchmark_symbol text
    check (benchmark_symbol is null or benchmark_symbol ~ '^[\^A-Za-z0-9.=-]{1,20}$');

comment on column public.settings.benchmark_symbol is
  'Symbole Yahoo de l''indice de comparaison (null : aucun)';

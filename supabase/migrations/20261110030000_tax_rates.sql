-- Taux utilisés pour estimer la fiscalité d'un retrait du PEA (réglables : ils changent avec les lois
-- de finances). Prélèvements sociaux après 5 ans ; impôt sur le revenu (PFU) en plus avant 5 ans.

alter table public.settings
  add column social_tax_rate numeric(5, 2) not null default 17.2
    check (social_tax_rate between 0 and 100),
  add column income_tax_rate numeric(5, 2) not null default 12.8
    check (income_tax_rate between 0 and 100);

comment on column public.settings.social_tax_rate is 'Prélèvements sociaux, en pourcents';
comment on column public.settings.income_tax_rate is 'Impôt sur le revenu (PFU), en pourcents';

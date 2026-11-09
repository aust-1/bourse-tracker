-- Rapport périodique (hebdomadaire ou mensuel), envoyé le dernier jour de bourse de la période,
-- à l'heure du résumé quotidien.
alter table public.settings
  add column report_frequency text check (report_frequency in ('weekly', 'monthly')),
  add column last_report_on date;

comment on column public.settings.report_frequency is 'weekly | monthly | null (aucun rapport)';

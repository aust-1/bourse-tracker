-- État du worker réservé à l'administrateur.
--
-- `worker_status` porte la liste des symboles en échec au dernier cycle (`failed`), tous comptes
-- confondus, et la dernière erreur du worker : un compte ne doit pas y lire les titres suivis par
-- les autres (même règle que `instruments`, `quotes_latest` et `price_history`). Seule la page
-- Supervision, réservée à l'administrateur, lit cette table.

drop policy worker_status_select on public.worker_status;

create policy worker_status_select on public.worker_status for select to authenticated
  using ((select public.is_admin()));

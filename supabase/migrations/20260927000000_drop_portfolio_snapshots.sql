-- La courbe du portefeuille est calculée à la demande (ordres + price_history) :
-- elle reste ainsi exacte après la modification d'un ordre ancien, sans recalcul nocturne.
drop table public.portfolio_snapshots;

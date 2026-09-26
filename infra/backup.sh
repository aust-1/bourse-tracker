#!/usr/bin/env bash
# Sauvegarde nocturne des DONNÉES (le schéma est recréé par `supabase db push`).
# Inclut les comptes (auth.users / auth.identities) : sans eux, les ordres, qui référencent
# l'utilisateur, ne pourraient pas être restaurés dans un projet Supabase neuf.
#
# Cron (VPS) :  15 2 * * *  cd /opt/bourse-tracker && set -a && . ./.env && set +a && ./infra/backup.sh >> /var/log/bourse-backup.log 2>&1
#
# Connexion : variables SUPABASE_DB_HOST, SUPABASE_DB_PASSWORD (obligatoires) et
#   SUPABASE_DB_PORT (5432), SUPABASE_DB_USER (postgres), SUPABASE_DB_NAME (postgres),
#   SUPABASE_DB_SSLMODE (require). Elles sont transmises à pg_dump par l'ENVIRONNEMENT du
#   conteneur : le mot de passe n'apparaît jamais dans une ligne de commande (visible via `ps`).
# Autres : BACKUP_DIR (défaut /var/backups/bourse-tracker), KEEP_DAYS (défaut 14)
set -euo pipefail

: "${SUPABASE_DB_HOST:?SUPABASE_DB_HOST manquant}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD manquant}"
export PGHOST="$SUPABASE_DB_HOST"
export PGPORT="${SUPABASE_DB_PORT:-5432}"
export PGUSER="${SUPABASE_DB_USER:-postgres}"
export PGDATABASE="${SUPABASE_DB_NAME:-postgres}"
export PGSSLMODE="${SUPABASE_DB_SSLMODE:-require}"
export PGPASSWORD="$SUPABASE_DB_PASSWORD"

DIR="${BACKUP_DIR:-/var/backups/bourse-tracker}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F-%H%M)"
OUT="$DIR/bourse-$STAMP.sql.gz"

mkdir -p "$DIR"
umask 077 # les sauvegardes contiennent des données personnelles

# NB : --table='public.*' et non --schema=public, car pg_dump combine mal les deux options
# (il ne garderait que les tables d'auth). worker_status est exclue : sa ligne unique est
# déjà créée par la migration, la restaurer provoquerait un conflit de clé.
docker run --rm -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE -e PGPASSWORD \
  postgres:17-alpine pg_dump \
  --data-only --column-inserts --no-owner --no-privileges \
  --table='public.*' --table=auth.users --table=auth.identities \
  --exclude-table=public.worker_status \
  | gzip -9 > "$OUT.tmp"

# Garde-fou : une sauvegarde incomplète ne doit jamais remplacer une bonne. pg_dump écrit un
# en-tête « Data for Name: <table> » pour chaque table dumpée, même vide.
CONTENT="$(gzip -dc "$OUT.tmp")"
for table in users orders instruments alerts settings price_history; do
  if ! grep -q "Data for Name: $table;" <<<"$CONTENT"; then
    echo "Sauvegarde incomplète : table $table absente" >&2
    rm -f "$OUT.tmp"
    exit 1
  fi
done
mv "$OUT.tmp" "$OUT"

find "$DIR" -name 'bourse-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "Sauvegarde OK : $OUT ($(du -h "$OUT" | cut -f1))"

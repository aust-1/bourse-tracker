#!/usr/bin/env bash
# Restaure une sauvegarde de données dans une base dont le schéma existe déjà
# (projet neuf : `supabase link` puis `supabase db push`, avant de lancer ce script).
#
# Usage : SUPABASE_DB_HOST=… SUPABASE_DB_PASSWORD=… ./infra/restore.sh /var/backups/bourse-tracker/bourse-2026-09-26-0215.sql.gz
#
# Mêmes variables de connexion que backup.sh (transmises par l'environnement du conteneur,
# jamais en argument de commande). Les données sont chargées en une seule transaction,
# contraintes différées : tout ou rien.
set -euo pipefail

: "${SUPABASE_DB_HOST:?SUPABASE_DB_HOST manquant}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD manquant}"
FILE="${1:?Usage: restore.sh <fichier.sql.gz>}"
[ -f "$FILE" ] || { echo "Fichier introuvable : $FILE" >&2; exit 1; }

export PGHOST="$SUPABASE_DB_HOST"
export PGPORT="${SUPABASE_DB_PORT:-5432}"
export PGUSER="${SUPABASE_DB_USER:-postgres}"
export PGDATABASE="${SUPABASE_DB_NAME:-postgres}"
export PGSSLMODE="${SUPABASE_DB_SSLMODE:-require}"
export PGPASSWORD="$SUPABASE_DB_PASSWORD"

{
  echo "SET session_replication_role = replica;"
  gzip -dc "$FILE"
} | docker run --rm -i -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE -e PGPASSWORD \
    postgres:17-alpine psql -v ON_ERROR_STOP=1 --single-transaction --quiet

echo "Restauration terminée depuis $FILE"

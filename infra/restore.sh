#!/usr/bin/env bash
# Restaure une sauvegarde de données dans une base dont le schéma existe déjà
# (projet neuf : `supabase link` puis `supabase db push`, avant de lancer ce script).
#
# Usage : SUPABASE_DB_URL=postgresql://... ./infra/restore.sh /var/backups/bourse-tracker/bourse-2026-09-26-0215.sql.gz
#
# Les données sont chargées en une seule transaction, contraintes différées : tout ou rien.
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL manquant}"
FILE="${1:?Usage: restore.sh <fichier.sql.gz>}"
[ -f "$FILE" ] || { echo "Fichier introuvable : $FILE" >&2; exit 1; }

{
  echo "SET session_replication_role = replica;"
  gzip -dc "$FILE"
} | docker run --rm -i postgres:17-alpine psql "$SUPABASE_DB_URL" \
    -v ON_ERROR_STOP=1 --single-transaction --quiet

echo "Restauration terminée depuis $FILE"

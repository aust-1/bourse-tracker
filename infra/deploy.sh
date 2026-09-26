#!/usr/bin/env bash
# Exécuté sur le VPS (à la main ou par le workflow de déploiement).
# Récupère la dernière version de main, reconstruit les images et redémarre les services.
set -euo pipefail

cd "$(dirname "$0")/.."

git fetch --quiet origin main
git reset --hard origin/main

docker compose build --pull
docker compose up -d --remove-orphans
docker image prune -f >/dev/null

# Le site doit répondre avant de déclarer le déploiement réussi
for i in $(seq 1 30); do
  if docker compose exec -T web wget -qO- http://127.0.0.1:3000/login >/dev/null 2>&1; then
    echo "Déploiement OK ($(git rev-parse --short HEAD))"
    exit 0
  fi
  sleep 2
done

echo "Le site ne répond pas après le déploiement" >&2
docker compose logs --tail=50 web worker >&2
exit 1

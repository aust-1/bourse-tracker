# Bourse Tracker

Suivi d'un PEA : journal des ordres, valeur du portefeuille quasi temps réel, alertes Discord/email.

## Structure

- `apps/web` : Next.js (App Router, Tailwind)
- `apps/worker` : polling des prix, alertes, résumé quotidien
- `packages/core` : logique métier pure (PRU, P&L, alertes)
- `supabase/` : migrations et config (projet `yhzfewtarlttlncqjebj`)
- `infra/` : Docker Compose, Caddy, sauvegardes

## Démarrage

```bash
pnpm install
cp .env.example .env   # puis renseigner les clés
pnpm dev --filter @bourse/web
```

## Vérifications

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

# Bourse Tracker

Suivi d'un **PEA** (actions et ETF européens, en EUR) : journal daté de chaque ordre, valeur du
portefeuille en quasi temps réel, alertes par Discord et email. Plusieurs comptes, sur invitation :
chacun ne voit que ses propres ordres, alertes, réglages et titres.

## Fonctionnalités

- **Ordres** : saisie manuelle (achat/vente, quantité, prix, frais, date-heure de Paris), modification,
  suppression, filtres (titre, sens, dates), totaux de la sélection, pagination, export CSV. Une vente à
  découvert est refusée **par la base** elle-même.
- **Portefeuilles** : plusieurs enveloppes par compte (PEA, PEA-PME, compte-titres) ; chaque ordre
  appartient à un portefeuille, la vente à découvert est contrôlée portefeuille par portefeuille et un
  sélecteur filtre tous les écrans.
- **Mouvements** : versements, retraits, dividendes et frais ; solde de liquidités, valeur totale
  (titres + liquidités) et jauges des plafonds de versements (PEA 150 000 €, PEA + PEA-PME 225 000 €).
- **Divisions de titres** : saisies par l'administrateur sur la fiche du titre ; les ordres antérieurs sont
  convertis en titres d'après la division (position, PRU, courbes, contrôle du découvert).
- **Fiscalité du PEA** : ancienneté (date des 5 ans) et estimation de l'impôt d'un retrait total
  (prélèvements sociaux, plus l'impôt sur le revenu avant 5 ans ; taux réglables).
- **ISIN et éligibilité** : ISIN saisi sur la fiche du titre (clé de contrôle vérifiée) ; un titre dont
  l'émetteur est hors EEE est signalé « hors PEA » sur la fiche et sur le tableau de bord d'un PEA.
  L'administrateur peut changer le symbole Yahoo d'un titre sans rien perdre (fusion si le même ISIN
  est déjà suivi sous ce symbole).
- **Tableau de bord en direct** : valeur, variation du jour (tient compte des ordres passés dans la journée),
  gain latent et réalisé, PRU (méthode du prix moyen pondéré), répartition par ligne et par type d'actif
  (ETF, actions, liquidités), mise à jour sans rechargement.
  Badge « Différé de N min » si la cote est ancienne pendant la séance.
- **Alertes** : seuil de prix (≥ / ≤), variation du jour, gain ou perte sur la position. Elles partent une
  seule fois, puis se ré-arment d'un clic. Historique avec l'état d'envoi par canal.
- **Historique** : courbe de la valeur du portefeuille, gain **hors apports** (un achat n'est pas de la
  performance), dividendes compris, rendement pondéré par le temps (TWR) et TRI annualisé (XIRR, sur
  un an ou plus), sur 1 M, 3 M, depuis janvier, 1 A ou Tout ; comparaison en base 100 à un indice
  de référence au choix (CAC 40, MSCI World…).
- **Résumé quotidien** à l'heure choisie, jours de bourse seulement.
- **Source de secours** : avec une clé EODHD, les cotes basculent automatiquement sur EODHD quand Yahoo
  échoue (disjoncteur : 3 échecs, 15 minutes).
- **Supervision** : alerte si la source de prix est muette en séance (aux administrateurs), ping
  Healthchecks.io du worker, page « Supervision » (administrateur) : état du worker, échecs de cotation,
  fraîcheur de chaque cote.
- **Comptes** : le premier compte est administrateur et crée des liens d'invitation (un compte par lien,
  7 jours). La base refuse toute inscription sans invitation valide. L'administrateur voit tous les
  comptes et peut en désactiver un (connexion refusée, plus d'alertes ni de résumé).
- **Sécurité** : mot de passe oublié (lien par email), double authentification TOTP imposée par la base
  (un compte qui l'a activée n'accède à rien avec son seul mot de passe), export de ses données en JSON
  et suppression de son compte.

## Architecture

```
Yahoo Finance ──(30 s, séance)──▶ worker ──▶ Supabase (Postgres, Auth, Realtime) ◀──▶ site Next.js
                                    │                                                   ▲
                                    └── alertes, résumé ──▶ Discord / Email            navigateur
```

| Dossier              | Rôle                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `apps/web`           | Next.js (App Router, Tailwind, Recharts) : pages, actions serveur, Realtime               |
| `apps/worker`        | Node : polling des prix, alertes, historique des clôtures, résumé, supervision            |
| `packages/core`      | Logique métier **pure** : PRU, P&L, gain du jour, alertes, séance, courbe du portefeuille |
| `packages/providers` | Source de prix (interface `PriceProvider` + Yahoo) et notifications Discord/Resend        |
| `packages/db`        | Types générés de la base et lecture paginée                                               |
| `supabase/`          | Migrations SQL, RLS, tests pgTAP                                                          |
| `infra/`             | Docker, déploiement, sauvegarde et restauration                                           |
| `docs/DEPLOY.md`     | **Mise en production pas à pas** et que faire en cas de panne                             |

Décisions à connaître :

- Les montants sont en EUR ; les ordres sont rejoués par date (achats avant ventes à l'instant égal).
- Le seuil d'une alerte est signé et comparé tel quel (`≥` pour les hausses, `≤` pour les baisses).
- La courbe est calculée à la demande depuis les ordres et les clôtures : elle reste exacte après la
  modification d'un ordre ancien.
- **Yahoo n'est pas une API officielle** : elle peut changer ou limiter les requêtes. Le changement de source
  se fait en un fichier (`PriceProvider`) ; un test nocturne détecte une casse. Voir `docs/DEPLOY.md`.

## Développement

Prérequis : Node 22+, pnpm, Docker (pour Supabase en local).

```bash
pnpm install
npx supabase start -x studio,imgproxy,vector,logflare,edge-runtime,storage-api,postgres-meta
cp .env.example .env   # pour le worker ; le web lit apps/web/.env.local (URL et clé anon locales)
pnpm --filter @bourse/web dev
```

## Vérifications

```bash
pnpm format:check && pnpm lint && pnpm typecheck   # qualité
pnpm test                                          # unitaires (core, providers, db, worker, web)
pnpm db:test                                       # base : RLS, contraintes, trigger anti-vente à découvert
INTEGRATION=1 pnpm --filter @bourse/worker exec vitest run   # worker contre la vraie base locale
pnpm e2e                                           # parcours complets dans un navigateur (Playwright)
pnpm --filter @bourse/providers test:live          # smoke test contre le vrai Yahoo
```

La CI GitHub exécute tout cela ; le déploiement sur le VPS suit une CI verte sur `main`.

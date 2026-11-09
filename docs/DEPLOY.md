# Mise en production

Tout ce qui suit se fait une seule fois. Durée : environ 1 heure.

## 1. Supabase (projet `yhzfewtarlttlncqjebj`)

```bash
npx supabase login
npx supabase link --project-ref yhzfewtarlttlncqjebj
npx supabase db push          # applique les migrations du dossier supabase/migrations
```

Dans le tableau de bord Supabase :

1. **Authentication → Users → Add user** : crée ton compte (email + mot de passe, « Auto Confirm User »).
   Le premier compte de l'instance en est l'**administrateur** : lui seul peut inviter d'autres personnes.
2. **Authentication → Sign In / Providers → Email** : laisse **Allow new users to sign up** activé (les
   invités s'inscrivent eux-mêmes) mais **désactive « Confirm email »** : l'envoi d'emails intégré de
   Supabase ne dessert que les membres de ton équipe Supabase. L'inscription reste fermée au public :
   la base refuse tout nouveau compte sans code d'invitation valide (trigger sur `auth.users`), ce qui
   bloque aussi « Add user » pour tout compte autre que le premier. Mets aussi **Minimum password
   length** à 8.
3. **Settings → API** : note l'URL, la clé `anon` et la clé `service_role`.
4. **Database → Replication** (ou `supabase_realtime` publication) : la table `quotes_latest` doit y figurer
   (la migration s'en charge ; vérifie-le si le tableau de bord ne se met pas à jour en direct).
5. **Mot de passe oublié** (page `/forgot`) :
   - **Authentication → URL Configuration** : _Site URL_ = `https://<domaine>` et ajoute
     `https://<domaine>/auth/confirm**` aux _Redirect URLs_ (sinon le lien de l'email renvoie
     vers la Site URL sans ouvrir la session).
   - **Authentication → Emails → SMTP Settings** : branche un SMTP (Resend : hôte `smtp.resend.com`,
     port `465`, utilisateur `resend`, mot de passe = clé API, expéditeur d'un domaine vérifié).
     Sans SMTP personnalisé, Supabase n'envoie le lien qu'aux membres de ton équipe Supabase.
   - Le lien par défaut (`{{ .ConfirmationURL }}`) doit être ouvert dans le navigateur qui a fait la
     demande. Pour qu'il marche depuis n'importe quel appareil, remplace-le dans le modèle
     _Reset Password_ par
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/settings/password`.
6. **Double authentification** : **Authentication → Multi-Factor → TOTP** doit être activé
   (enrôlement et vérification). Chacun l'active ensuite depuis **Réglages**. La base impose le
   second facteur (politiques restrictives `*_mfa`, migration `20261109000000_mfa.sql`) : un compte
   qui l'a activé n'accède à rien avec son seul mot de passe, même par l'API. Code perdu :
   l'administrateur supprime le facteur dans **Authentication → Users → (compte) → MFA factors**.

## 2. Services externes

| Service         | À faire                                                                                                  | Variable                |
| --------------- | -------------------------------------------------------------------------------------------------------- | ----------------------- |
| Discord         | Salon → Modifier → Intégrations → Webhooks → Nouveau → Copier l'URL (à coller dans **Réglages** du site) | —                       |
| Resend          | Créer un compte, générer une clé API                                                                     | `RESEND_API_KEY`        |
| Healthchecks.io | Créer un check « worker » : période 1 min, délai de grâce 5 min ; ajouter ton email en canal             | `HEALTHCHECKS_PING_URL` |

Resend, sans domaine vérifié, n'envoie qu'à l'adresse du compte Resend : les alertes par email ne
partiront que vers toi. Pour que les personnes invitées reçoivent aussi leurs emails, vérifie un domaine
dans Resend et mets à jour `EMAIL_FROM` ; sinon, elles utilisent Discord.

## 3. VPS

Ce dépôt fait partie du dépôt `vps-strasbourg-opt`, cloné en un seul morceau dans `/opt` (voir
son `docs/deploy.md`) : ce projet devient le sous-module `/opt/apps/bourse-tracker`, ajouté
avec `scripts/app-add.sh bourse-tracker <url-de-ce-dépôt>` depuis `/opt`. Il n'ouvre aucun port :
le proxy Caddy partagé du VPS route vers lui via `./Caddyfile` (ce dépôt), sur le réseau Docker
externe `proxy` (variable `PROXY_NETWORK`, alias `bourse-web`).

Étapes, depuis `/opt` :

```bash
scripts/app-add.sh bourse-tracker <url-de-ce-dépôt>   # clone en apps/bourse-tracker, crée .env
nano apps/bourse-tracker/.env                         # renseigner toutes les valeurs Supabase/Resend
scripts/app-deploy.sh bourse-tracker                  # build, démarre, attend le healthcheck, publie la route
```

Ouvrir `https://bourse.eliott-roussille.fr` (domaine déclaré dans `./Caddyfile`) : la page de connexion
doit s'afficher (certificat émis par Caddy, la première fois cela peut prendre quelques secondes).
Se connecter, puis **Réglages** : coller le webhook Discord, l'email, et cliquer sur **Envoyer un test**.

Pare-feu conseillé : n'ouvrir que les ports 22, 80 et 443 (`ufw allow 22,80,443/tcp && ufw enable`).
Attention : les ports publiés par Docker contournent `ufw`. Ce projet n'en publie aucun, ce qui est voulu.

## 4. Sauvegardes

Ce script est indépendant de `scripts/backup.sh` du dépôt opt (qui sauvegarde les volumes Docker
et les `.env`, pas les données Supabase). Les deux sont complémentaires.

```bash
crontab -e
# ajouter (chemin sous /opt une fois ajouté comme sous-module ; permissions gérées par
# scripts/fix-perms.sh du dépôt opt, qui suit ce dépôt) :
15 2 * * *  cd /opt/apps/bourse-tracker && set -a && . ./.env && set +a && ./infra/backup.sh >> /var/log/bourse-backup.log 2>&1
```

Le plan gratuit Supabase n'a pas de restauration à un instant donné : cette sauvegarde nocturne
(14 jours conservés) est ta protection. Copie régulièrement `/var/backups/bourse-tracker` hors du VPS
(par exemple `rsync` vers ton PC). Le bouton **Export CSV** de la page Ordres est une seconde protection.

**Restaurer** dans un projet dont le schéma existe (`supabase db push`) :

```bash
SUPABASE_DB_HOST=… SUPABASE_DB_PASSWORD=… ./infra/restore.sh /var/backups/bourse-tracker/bourse-AAAA-MM-JJ-HHMM.sql.gz
```

La procédure a été testée : sauvegarde, remise à zéro complète de la base, restauration, puis
vérification des ordres, alertes, comptes et instruments.

## 5. Déploiement automatique (optionnel)

Comme toutes les apps du VPS (détail : `docs/ci-deploy.md` du dépôt opt) : à chaque `push` sur
`main` dont la CI est verte, le workflow **Déploiement** se connecte au compte `gh-deploy` avec une
clé bridée à une seule commande, `sudo opt-deploy bourse-tracker`. Le serveur avance ce sous-module
sur `origin/main` (et refuse s'il y trouve des modifications locales), reconstruit les images,
attend que les conteneurs soient sains, republie la route, puis aligne le pointeur du sous-module
dans le dépôt opt (commit local, jamais poussé).

1. Sur le serveur, en root, une fois : `scripts/deploy-install.sh`, puis
   `scripts/deploy-install.sh --key bourse-tracker 'ssh-ed25519 …'` avec la clé publique d'une paire
   créée pour ce dépôt seulement (`ssh-keygen -t ed25519 -N '' -C deploy-bourse-tracker -f deploy-bourse-tracker`).
2. Dans GitHub → Settings → Secrets and variables → Actions : `VPS_HOST`, `VPS_SSH_KEY` (la clé
   **privée** de cette paire) et `VPS_KNOWN_HOSTS` (clé d'hôte du serveur, épinglée : voir
   `docs/ci-deploy.md`). Les anciens secrets `VPS_USER` et `VPS_PATH` ne servent plus.

Le déploiement automatique n'applique pas les migrations Supabase : `npx supabase db push` reste à
lancer avant de pousser un code qui en dépend. À la main, sur le serveur : `sudo opt-deploy bourse-tracker`.

## 6. Inviter quelqu'un

Menu **Invitations** (visible de l'administrateur seulement) : **Créer un lien d'invitation**, puis
envoyer le lien. Il crée un seul compte et expire au bout de 7 jours ; tant qu'il n'est pas utilisé,
il se révoque d'un clic. Chaque compte a ses propres ordres, alertes, réglages et titres suivis.
Les cotes d'un titre sont partagées (une seule requête à Yahoo par titre), mais un compte ne voit que
les titres qu'il suit. Les messages système (source de prix en panne) ne vont qu'aux administrateurs.

**Passer une installation existante en multi-utilisateur**, dans cet ordre :

1. `npx supabase db push` applique la migration `20260928000000_multi_user.sql`. Ton compte devient
   administrateur et garde tous les titres déjà enregistrés ; tes ordres, alertes et réglages lui
   restent rattachés. À faire **avant** de pousser le code sur `main` : le nouveau site appelle des
   fonctions que crée cette migration (le déploiement automatique n'applique pas les migrations).
2. Ajuste les réglages d'authentification de l'étape 1.
3. Pousse le code sur `main` (ou `sudo opt-deploy bourse-tracker` sur le VPS).

## 7. Première séance : mesurer le retard de Yahoo

Le retard des cotes Euronext sur Yahoo n'a pas pu être mesuré hors séance. Un jour de bourse, pendant la séance :

```bash
docker compose logs worker --since 10m | grep "cycle terminé"
```

Le champ `maxQuoteLagSeconds` (avec `marketOpen: true`) donne le retard réel. S'il dépasse ~900 s (15 min),
Yahoo sert des cotes différées : le tableau de bord l'affiche (badge « Différé de N min ») et les alertes
de prix sont évaluées sur ces cotes différées. Pour du temps réel, voir le plan B ci-dessous.

## 8. Que faire quand…

**Alerte « Source de prix indisponible »** (Discord/email) : Yahoo ne répond plus depuis plus de 5 minutes en séance.
Regarder `docker compose logs worker`. Si l'API a changé de format, le smoke test nocturne de GitHub (« Smoke test Yahoo »)
échouera aussi. **Secours automatique** : avec `EODHD_API_KEY` dans `.env`, le worker prend ses cotes chez EODHD
après 3 échecs consécutifs de Yahoo (pendant 15 minutes, puis retente Yahoo) ; les logs le signalent
(« source de prix basculée »). L'historique et la recherche restent sur Yahoo. Plan B durable : implémenter l'interface `PriceProvider` (`packages/providers/src/types.ts`) pour EODHD ou
Twelve Data (plan Grow, 29 $/mois pour l'Europe), et remplacer `new YahooProvider()` dans `apps/worker/src/index.ts`
et `apps/web/lib/yahoo.ts` : un fichier de plus, aucune autre modification.

**Le worker ne « ping » plus** : Healthchecks.io t'envoie un email. `docker compose ps`, puis `docker compose restart worker`.

**Le site ne répond plus** : `docker compose logs web`, puis, depuis `/opt`, `scripts/status.sh` (route publiée ?
alias réseau correct ?) et `docker logs caddy`, puis `sudo opt-deploy bourse-tracker`.

**Courbe en escalier sur les périodes anciennes** (avant le correctif `b8b6d50`, l'historique des ordres de plus
d'un an était rempli en barres **mensuelles**) : vider une fois les clôtures, le worker les recharge en journalier à
son cycle suivant (une minute, en séance ou non).

```sql
delete from public.price_history;  -- SQL Editor de Supabase ; aucune donnée saisie n'est perdue
```

puis `docker compose restart worker`.

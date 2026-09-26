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

1. Serveur Debian/Ubuntu (Hetzner CX22, ~4 €/mois), un **nom de domaine ou sous-domaine** dont l'enregistrement DNS `A` pointe vers l'IP du serveur.
2. Docker installé (`curl -fsSL https://get.docker.com | sh`) **et un Traefik déjà en service** : c'est lui qui écoute
   sur les ports 80 et 443. Ce projet n'ouvre aucun port : il déclare le site à Traefik par des labels
   (`docker-compose.yml`) sur le réseau Docker partagé. Le Traefik doit avoir le provider Docker activé avec
   `exposedByDefault=false` (labels `traefik.enable=true` explicites), un entrypoint `websecure` et un résolveur
   de certificats `myresolver`, sur le réseau externe `traefik-network`. Ce sont les noms de ton VPS actuel ;
   s'ils diffèrent, ajuste `TRAEFIK_NETWORK`, `TRAEFIK_ENTRYPOINT` et `TRAEFIK_CERTRESOLVER` dans `.env`.
   Vérifier : `docker network ls | grep traefik`.
3. Récupérer le code et configurer :

   ```bash
   git clone <url-du-dépôt> /opt/bourse-tracker && cd /opt/bourse-tracker
   cp .env.example .env && nano .env      # renseigner toutes les valeurs
   docker compose up -d --build
   ```

4. Ouvrir `https://<ton-domaine>` : la page de connexion doit s'afficher (le certificat est émis par Traefik,
   la première fois cela peut prendre quelques secondes).
5. Se connecter, puis **Réglages** : coller le webhook Discord, l'email, et cliquer sur **Envoyer un test**.

Pare-feu conseillé : n'ouvrir que les ports 22, 80 et 443 (`ufw allow 22,80,443/tcp && ufw enable`).
Attention : les ports publiés par Docker contournent `ufw`. Ce projet n'en publie aucun, ce qui est voulu.

Principe des labels : le routeur `bourse` envoie `Host(<DOMAIN>)` vers le port 3000 du conteneur `web`, avec
compression et en-têtes de sécurité (HSTS, `X-Frame-Options`, etc.). Ce routage a été testé contre un vrai
Traefik : routeur chargé, service en état `UP`, réponse 200 sur le bon domaine et 404 sur un autre.

## 4. Sauvegardes

```bash
chmod +x infra/*.sh
crontab -e
# ajouter :
15 2 * * *  cd /opt/bourse-tracker && set -a && . ./.env && set +a && ./infra/backup.sh >> /var/log/bourse-backup.log 2>&1
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

Dans GitHub → Settings → Secrets and variables → Actions, ajouter :
`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (clé privée dédiée, dont la clé publique est dans `~/.ssh/authorized_keys` du VPS),
`VPS_PATH` (`/opt/bourse-tracker`) et `VPS_KNOWN_HOSTS`. Ce dernier est la clé d'hôte du serveur, à récupérer
une seule fois depuis un réseau de confiance : `ssh-keyscan -t ed25519 <ip-du-vps>`. Elle est épinglée dans le workflow
(`StrictHostKeyChecking=yes`), de sorte qu'un intercepteur ne puisse pas se faire passer pour ton serveur. À chaque `push` sur `main` dont la CI est verte, le VPS exécute `infra/deploy.sh`.

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
3. Pousse le code sur `main` (ou `./infra/deploy.sh` sur le VPS).

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
échouera aussi. Plan B : implémenter l'interface `PriceProvider` (`packages/providers/src/types.ts`) pour EODHD ou
Twelve Data (plan Grow, 29 $/mois pour l'Europe), et remplacer `new YahooProvider()` dans `apps/worker/src/index.ts`
et `apps/web/lib/yahoo.ts` : un fichier de plus, aucune autre modification.

**Le worker ne « ping » plus** : Healthchecks.io t'envoie un email. `docker compose ps`, puis `docker compose restart worker`.

**Le site ne répond plus** : `docker compose logs web`, puis `docker logs <conteneur-traefik>` (routeur non chargé ? mauvais nom de réseau ?), puis `./infra/deploy.sh`.

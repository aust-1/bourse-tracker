# Feuille de route

Améliorations identifiées après la v1 (M1 → M11). Cochées au fil des commits, dans l'ordre de
réalisation ci-dessous (les numéros renvoient à la liste d'origine).

## 1. Comptes et sécurité

- [x] **18 — Mot de passe oublié** : demande de lien par email, page de nouveau mot de passe.
- [x] **19 — Double authentification (TOTP)** : activation depuis les réglages, code demandé à la
      connexion (niveau `aal2` exigé dès qu'un facteur est enrôlé).
- [x] **20 — Gestion des comptes** : export de toutes ses données (JSON), suppression de son compte ;
      pour l'administrateur, liste des comptes et désactivation / réactivation.
- [x] **21 — Page de supervision (administrateur)** : dernier cycle du worker, dernière erreur,
      instruments sans cote ou à cote ancienne, retard observé.

## 2. Hygiène et justesse de base

- [x] **25 — Nettoyage** : dossier vide parasite `Caddyfile;C` supprimé (non suivi par git).
- [x] **3 — Jours fériés Euronext** : calendrier des fermetures (1er janvier, Vendredi saint, lundi de
      Pâques, 1er mai, 25 et 26 décembre) dans `isMarketOpen` / fenêtres du worker.

## 3. Modèle de données PEA

- [x] **8 — Plusieurs comptes par utilisateur** (PEA, PEA-PME, compte-titres) : table `accounts`,
      ordres rattachés à un compte, sélecteur de compte, données existantes rattachées à un PEA.
- [x] **5 — Liquidités et versements** : dépôts / retraits d'espèces, solde de liquidités, valeur
      totale du compte, suivi du plafond de versements (150 000 € PEA, 225 000 € PEA + PEA-PME).
- [x] **1 — Dividendes** : mouvement « dividende » (montant net) compté dans le gain réalisé, la
      courbe et les liquidités.
- [x] **2 — Divisions / regroupements (splits)** : événement de split qui ajuste quantités et PRU,
      pris en compte par le rejeu des ordres.
- [x] **6 — Date d'ouverture et ancienneté** : compteur des 5 ans, estimation des prélèvements
      sociaux sur la plus-value latente (taux réglable).

## 4. Performance

- [x] **4 — TWR et TRI (XIRR)** : rendement pondéré par le temps et TRI annualisé sur l'historique.
- [x] **11 — Indice de référence** : comparaison de la courbe à un indice ou ETF choisi.
- [x] **24 — Cache de l'historique** : clôtures (le coût principal) gardées en cache, invalidées par
      une version des données de marché incrémentée par la base ; ordres et mouvements relus à
      chaque affichage, donc toujours à jour.

## 5. Instruments et source de prix

- [x] **7 — ISIN et éligibilité PEA** : ISIN renseigné (saisie / recherche), alerte si l'ISIN n'est
      pas d'un pays de l'EEE.
- [x] **23 — Rattachement par ISIN** : changement de symbole Yahoo sans perte d'historique.
- [x] **22 — Seconde source de prix** : fournisseur de secours avec bascule automatique.

## 6. Écrans

- [x] **14 — Page Ordres** : pagination, filtre par dates, totaux de la sélection, montant frais
      compris.
- [x] **10 — Répartition** : graphique des poids par ligne et par type (ETF / action).
- [x] **15 — Fiche instrument** : PRU sur le graphique (déjà en place), performance totale de la ligne
      (latent + réalisé + dividendes), dividendes reçus.
- [x] **9 — Import CSV** : import d'ordres depuis un CSV (format de l'export + formats courtiers
      courants), avec aperçu avant validation.

## 7. Alertes et notifications

- [x] **12 — Alertes plus riches** : réarmement automatique avec délai, baisse depuis le plus haut,
      alertes sur le portefeuille entier, note libre.
- [x] **13 — Rapport hebdomadaire / mensuel** en plus du résumé quotidien.
- [x] **16 — Autres canaux** : ntfy (push mobile) et Telegram.

## 8. Mobile

- [x] **17 — PWA** : manifeste, icônes, installable ; tableau de bord lisible sur téléphone.

---

# Deuxième vague

Améliorations identifiées après la première vague (PR #8). Ordre de réalisation proposé : les trois
premières sections réutilisent l'existant (clôtures, cache, alertes, graphiques) sans nouvelle source
de données.

## 9. Titres suivis hors portefeuille

- [ ] **26 — Liste de suivi** : bouton « Suivre » dans la recherche et sur la fiche du titre
      (`user_instruments` + indicateur `watched`, note facultative) ; le worker cote aussi les titres
      suivis, éventuellement moins souvent (toutes les 5 minutes).
- [ ] **27 — Page « Suivi »** : cours, variation du jour, écart au plus haut / plus bas sur 52 semaines,
      variation depuis l'ajout et prix de référence noté à l'ajout ; raccourcis « créer une alerte » et
      « passer un ordre ».
- [ ] **28 — Ordres simulés** : portefeuille fictif séparé des vrais par la base, pour tester une
      stratégie ou comparer « si j'avais acheté au lieu de vendre ».

## 10. Historique

- [ ] **29 — Dates libres** : sélection « du / au » conservée dans l'URL, en plus des périodes fixes.
- [ ] **30 — Périodes supplémentaires** : 1 semaine, 6 mois, 3 ans, 5 ans, depuis l'ouverture du
      portefeuille, depuis le premier ordre.
- [ ] **31 — Fiche du titre** : périodes 5 ans et maximum ; ordres marqués sur la courbe (achat /
      vente).
- [ ] **32 — Vue par année** : tableau rendement, gain, apports et dividendes par année civile.
- [ ] **33 — Rendements mensuels** : grille mois × année colorée selon le rendement.

## 11. Indicateurs

- [ ] **34 — Indicateurs techniques** (calculés dans `core` à partir des clôtures stockées) : moyennes
      mobiles 50 / 200 jours sur le graphique, plus haut / plus bas sur 52 semaines, volatilité annualisée,
      baisse maximale sur la période, RSI.
- [ ] **35 — Indicateurs du portefeuille** : volatilité, baisse maximale, ratio de Sharpe sur la période,
      concentration (poids de la première ligne, des trois premières), part PEA / CTO.
- [ ] **36 — Données fondamentales** : PER, rendement du dividende, capitalisation, secteur, pays, frais
      courants des ETF (source Yahoo `quoteSummary`, stockées avec leur date et présentées comme
      indicatives).
- [ ] **37 — Répartition par secteur et par pays** du portefeuille (à partir des données
      fondamentales).

## 12. Améliorer l'existant

### Données et justesse

- [ ] **38 — Dividendes détectés** : événements Yahoo (`events=div`) proposés au worker pour les titres
      détenus, à confirmer d'un clic.
- [ ] **39 — Splits détectés** : événements Yahoo (`events=split`) signalés à l'administrateur.
- [ ] **40 — Calendrier par place** : jours fériés de Xetra, Milan, Madrid… en plus d'Euronext.
- [ ] **41 — Historique stocké** : instantané journalier par portefeuille calculé par le worker,
      invalidé à chaque modification d'ordre ou de mouvement (page Historique instantanée).
- [ ] **42 — Script `pnpm db:types`** : génération des types fiable en local (port de Postgres).

### Tableau de bord

- [ ] **43 — Colonnes** triables (poids, gain, variation du jour) et au choix ; colonnes poids (% du
      portefeuille) et dividendes reçus par ligne.
- [ ] **44 — Courbe de la séance** : valeur du portefeuille minute par minute aujourd'hui.
- [ ] **45 — Retard des cotes** explicite (différé Yahoo) et heure de la dernière cote dans l'en-tête.

### Ordres et mouvements

- [ ] **46 — Suppression réversible** : confirmation ou « Annuler » pendant quelques secondes (ordres,
      mouvements, alertes).
- [ ] **47 — Dupliquer un ordre** (« racheter aux mêmes conditions »).
- [ ] **48 — Mouvements** : filtres (type, dates) et export CSV réimportable.
- [ ] **49 — Import CSV** : mouvements (dividendes, versements) et vrais formats des courtiers courants,
      testés sur des fichiers d'exemple.

### Alertes et notifications

- [ ] **50 — Modifier une alerte** sans la recréer.
- [ ] **51 — Alertes sur indicateurs** : franchissement de la moyenne 200 jours, nouveau plus haut /
      plus bas sur 52 semaines, RSI ; alertes sur un titre suivi.
- [ ] **52 — Regroupement** : un seul message quand plusieurs alertes partent au même cycle.
- [ ] **53 — Heures calmes** par canal (pas de notification la nuit).
- [ ] **54 — Messages** : mise en forme par canal (Telegram, lien cliquable ntfy), lien vers le site,
      petit graphique joint au rapport (email, Telegram).

### Sécurité et comptes

- [ ] **55 — Codes de secours** de la double authentification.
- [ ] **56 — Historique des connexions** (date, appareil) dans les réglages.
- [ ] **57 — Limitation des tentatives** sur la connexion et le mot de passe oublié, côté application.

### Exploitation et code

- [ ] **58 — Test réel EODHD** : test en direct facultatif, comme celui de Yahoo, si une clé est
      présente.
- [ ] **59 — Métriques du worker** : durée des cycles et taux d'échec par source sur 24 h dans la
      Supervision.
- [ ] **60 — Conversion des ordres factorisée** : une seule fonction base → `core` au lieu de quatre
      copies (fiche titre, action des alertes, worker, `queries.ts`) ; conversion `numeric` → `number`
      vérifiée partout.
- [ ] **61 — Accessibilité** : navigation au clavier (sélecteur, formulaires) et contrastes du thème.

## 13. Nouvelles fonctionnalités

- [ ] **62 — Plusieurs devises** (actions américaines sur un CTO) : taux de change, valorisation en EUR.
- [ ] **63 — Objectifs et rééquilibrage** : répartition cible par ligne et suggestion d'achats pour y
      revenir.
- [ ] **64 — Plan d'investissement programmé** : rappel mensuel et suivi de l'investissement progressif.
- [ ] **65 — Récapitulatif fiscal annuel** d'un CTO (plus-values réalisées, dividendes).
- [ ] **66 — Partage public en lecture** d'un portefeuille, en pourcentages seulement.

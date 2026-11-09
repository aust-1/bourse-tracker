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
- [ ] **24 — Cache de l'historique** : séries calculées mises en cache, invalidées à chaque
      modification d'ordre ou de mouvement.

## 5. Instruments et source de prix

- [ ] **7 — ISIN et éligibilité PEA** : ISIN renseigné (saisie / recherche), alerte si l'ISIN n'est
      pas d'un pays de l'EEE.
- [ ] **23 — Rattachement par ISIN** : changement de symbole Yahoo sans perte d'historique.
- [ ] **22 — Seconde source de prix** : fournisseur de secours avec bascule automatique.

## 6. Écrans

- [ ] **14 — Page Ordres** : pagination, filtre par dates, totaux de la sélection, montant frais
      compris.
- [ ] **10 — Répartition** : graphique des poids par ligne et par type (ETF / action).
- [ ] **15 — Fiche instrument** : PRU sur le graphique, performance de la ligne, dividendes reçus.
- [ ] **9 — Import CSV** : import d'ordres depuis un CSV (format de l'export + formats courtiers
      courants), avec aperçu avant validation.

## 7. Alertes et notifications

- [ ] **12 — Alertes plus riches** : réarmement automatique avec délai, baisse depuis le plus haut,
      alertes sur le portefeuille entier, note libre.
- [ ] **13 — Rapport hebdomadaire / mensuel** en plus du résumé quotidien.
- [ ] **16 — Autres canaux** : ntfy (push mobile) et Telegram.

## 8. Mobile

- [ ] **17 — PWA** : manifeste, icônes, installable ; tableau de bord lisible sur téléphone.

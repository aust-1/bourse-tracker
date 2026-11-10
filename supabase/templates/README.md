# Modèles d'emails Supabase

Un fichier HTML par email envoyé par Supabase Auth, au thème de l'application. À coller dans le
tableau de bord : **Authentication → Emails → Templates** (et **Security notifications** pour les
notifications), champ _Subject_ et corps du message (onglet _Source_).

Ces fichiers ne sont pas branchés dans `supabase/config.toml` : en local, la _Site URL_ vaut
`http://127.0.0.1:3000` alors que les tests e2e tournent sur le port 3100, et les liens
`{{ .SiteURL }}` les casseraient.

## Emails d'authentification

Les liens passent par `/auth/confirm?token_hash=…&type=…` : ils marchent depuis n'importe quel
appareil, contrairement au `{{ .ConfirmationURL }}` par défaut (flux PKCE, même navigateur
uniquement). Ils exigent que _Site URL_ soit le domaine public et que
`https://<domaine>/auth/confirm**` figure dans les _Redirect URLs_.

| Modèle Supabase     | Fichier                 | Objet                               | Utilisé par l'application                                                                 |
| ------------------- | ----------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Reset Password      | `recovery.html`         | Réinitialise ton mot de passe       | oui : page `/forgot`                                                                      |
| Confirm signup      | `confirmation.html`     | Confirme ton adresse email          | seulement si « Confirm email » est activé (désactivé d'après `docs/DEPLOY.md`)            |
| Invite user         | `invite.html`           | Invitation à Bourse Tracker         | non : le trigger d'inscription refuse les comptes sans code d'invitation de l'application |
| Magic Link          | `magic_link.html`       | Ton lien de connexion               | non (pas de connexion sans mot de passe)                                                  |
| Change Email Address | `email_change.html`    | Confirme ton changement d'adresse   | non (pas d'écran de changement d'adresse)                                                 |
| Reauthentication    | `reauthentication.html` | Ton code de confirmation            | seulement si « Secure password change » est activé                                        |

Laisse **Secure password change** désactivé : l'écran `/settings/password` n'envoie pas le code de
réauthentification (`nonce`), le changement de mot de passe serait refusé à toute session ouverte
depuis plus de quelques minutes.

Les liens expirent au bout d'une heure (_Email OTP Expiration_ par défaut). Si tu changes ce
réglage, adapte le texte des modèles.

## Notifications de sécurité

Désactivées par défaut chez Supabase : active chacune dans **Security notifications** avant d'y
coller son modèle. Elles ne contiennent aucun lien.

| Notification            | Fichier                                    | Objet                                | Variables                     |
| ----------------------- | ------------------------------------------ | ------------------------------------ | ----------------------------- |
| Password changed        | `password_changed_notification.html`       | Ton mot de passe a été changé        | `.Email`                      |
| Email address changed   | `email_changed_notification.html`          | Ton adresse email a été changée      | `.Email`, `.OldEmail`         |
| Phone number changed    | `phone_changed_notification.html`          | Ton numéro de téléphone a été changé | `.Email`, `.Phone`, `.OldPhone` |
| Identity linked         | `identity_linked_notification.html`        | Nouveau moyen de connexion associé   | `.Email`, `.Provider`         |
| Identity unlinked       | `identity_unlinked_notification.html`      | Moyen de connexion retiré            | `.Email`, `.Provider`         |
| MFA method added        | `mfa_factor_enrolled_notification.html`    | Double authentification activée      | `.Email`, `.FactorType`       |
| MFA method removed      | `mfa_factor_unenrolled_notification.html`  | Double authentification désactivée   | `.Email`, `.FactorType`       |

Les plus utiles ici : mot de passe changé et double authentification ajoutée ou retirée.

## Modifier un modèle

Le dossier est exclu de Prettier (`.prettierignore`) : il couperait les balises `{{ … }}` sur deux
lignes. Garde chaque balise sur une seule ligne et les styles en ligne (`style="…"`), seuls lus par
la plupart des messageries.

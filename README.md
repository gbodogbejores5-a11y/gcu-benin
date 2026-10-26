# GCU-BÉNIN — Site officiel de GÉNIE CIVIL UNIS — BÉNIN

Site communautaire professionnel : vitrine animée + espace membre + administration sécurisée,
reposant sur une **vraie base de données** (Supabase / PostgreSQL) et hébergé gratuitement sur **Cloudflare Pages**.

---

## 1. Le concept en 2 minutes

```
 VISITEUR ──► Site public (pages HTML/CSS/JS, hébergé sur Cloudflare Pages)
                 │  lit les actualités, événements, ressources, offres…
                 │  envoie : demande d'adhésion, message de contact, proposition de partenariat
                 ▼
          SUPABASE  (base de données PostgreSQL + comptes + fichiers + temps réel)
                 ▲  Les règles de sécurité (RLS) sont DANS la base : même si quelqu'un
                 │  « triche » dans son navigateur, la base refuse ce qu'il n'a pas le droit de faire.
 MEMBRE ────────┘  se connecte → profil, carte de membre numérique (QR), inscriptions, notifications
 RESPONSABLES ───► /admin → gèrent les contenus, les adhésions, la messagerie… selon leur rôle
```

**Parcours d'un membre**
1. Il remplit le formulaire d'adhésion → reçoit un **code de suivi** (statut : en attente → en examen → accepté/refusé).
2. Un responsable des adhésions **accepte** la demande dans l'administration → la fiche membre et son **n° de membre** (`GCU-2026-0001`) sont créés automatiquement.
3. Le membre **crée son compte** avec la même adresse e-mail (confirmée par e-mail) → son espace s'ouvre : **carte de membre numérique** (QR code de vérification, téléchargement PNG, impression), ressources réservées, inscriptions aux événements, notifications.

**Sécurité intégrée**
- Permissions vérifiées **côté base de données** (pas seulement des boutons cachés) ; rôles **configurables** (administrateur principal/technique, communication, adhésions, ressources, opportunités, messagerie, + rôles personnalisés).
- Mots de passe **jamais en clair** (gérés par Supabase Auth), limitation des tentatives, protection anti-robots des formulaires (pot de miel + délai + quotas côté serveur).
- Documents « membres » dans un **stockage privé** (liens signés de 2 minutes).
- **Journal des actions** automatique (qui a créé / modifié / supprimé quoi), déconnexion automatique de l'admin après 30 min d'inactivité, **double authentification (TOTP)** disponible.
- En-têtes de sécurité stricts (fichier `_headers` : CSP, anti-clickjacking, HTTPS forcé…).

---

## 2. Où mettre les images ? (important)

| Type d'image | Où la mettre |
|---|---|
| **Images fixes du design** (bannière d'accueil, photo « qui sommes-nous », fond du bandeau, aperçu de partage, logo) | Dossier **`assets/images/`** avec les noms exacts : `hero.jpg`, `about.jpg`, `cta.jpg`, `og-image.jpg`, `logo.png` — voir **`assets/images/LISEZ-MOI.txt`** (tailles conseillées incluses). |
| **Images dynamiques** (actualités, événements, galerie, photos de l'équipe, logos des partenaires) | **Pas dans le dossier.** On les téléverse depuis **l'administration** (champ « Image » des formulaires) : elles vont dans la base (Supabase Storage). |
| **Documents** (PDF, Word, Excel…) | Administration → **Ressources** → champ « Fichier ». |

> Tant qu'une image fixe n'est pas ajoutée, le site affiche un motif « plan d'ingénieur » : rien n'est cassé.
> **Pour un rendu qui attire l'attention : ajoutez au minimum `hero.jpg` (chantier / pont / grue, photo plutôt sombre) et `about.jpg`.**

**Logo du client** : déposez `assets/images/logo.png`, puis dans `js/config.js` : `LOGO: "assets/images/logo.png"`.

---

## 3. Contenu du dossier

```
gcu-benin/
├─ index.html … conditions.html   Pages publiques (22 pages)
├─ admin/index.html               Administration (accessible sur /admin/)
├─ css/style.css                  Design (couleurs en haut du fichier : modifiables)
├─ js/config.js                   ⬅ LE SEUL FICHIER À MODIFIER (clés Supabase, adresse du site)
├─ js/*.js                        Logique du site
├─ assets/images/                 Images fixes (voir LISEZ-MOI.txt)
├─ supabase/
│   ├─ 01_schema.sql              Tables, sécurité (RLS), fonctions, stockage
│   ├─ 02_donnees_initiales.sql   Rôles, permissions, FAQ, organigramme de départ
│   ├─ 03_premier_administrateur.sql
│   └─ 04_optionnel_exiger_mfa.sql
├─ _headers  robots.txt  sitemap.xml
└─ README.md
```

---

## 4. Mise en ligne pas à pas (≈ 45 minutes, 0 FCFA pour démarrer)

### Étape 1 — Créer le projet Supabase
1. Créez un compte sur **supabase.com** → *New project* (région : choisissez la plus proche, ex. *West EU*), notez le mot de passe de la base.
2. **SQL Editor → New query** : collez tout `supabase/01_schema.sql` → **Run**. Puis `02_donnees_initiales.sql` → **Run**.

### Étape 2 — Relier le site
1. Supabase → **Project Settings → API** : copiez **Project URL** et la clé **anon public**.
2. Ouvrez `js/config.js` et remplacez `SUPABASE_URL` et `SUPABASE_ANON_KEY`.
   ⚠ N'écrivez **jamais** la clé `service_role` dans le site.
3. Supabase → **Authentication → URL Configuration** : *Site URL* = l'adresse finale du site (ex. `https://gcu-benin.pages.dev`) ; *Redirect URLs* : ajoutez `https://gcu-benin.pages.dev/**`.
4. **Authentication → Providers → Email** : laissez *Confirm email* **activé** ; mot de passe minimum **10** caractères.
5. **Storage** : les 2 espaces (`media` public, `resources` privé) sont créés par le script SQL ; vérifiez qu'ils apparaissent.

### Étape 3 — Hébergement (Cloudflare Pages)
1. Compte gratuit sur **dash.cloudflare.com → Workers & Pages → Create → Pages → Upload assets**.
2. Glissez le **contenu** du dossier `gcu-benin` (pas le ZIP lui-même) → *Deploy*.
3. Indiquez l'adresse obtenue dans `js/config.js` (`SITE_URL`) et dans `robots.txt` / `sitemap.xml` (remplacer `VOTRE-DOMAINE`), puis redéployez.
4. (Plus tard) Domaine personnalisé : *Custom domains* (ex. `gcu-benin.org`).

### Étape 4 — Créer le premier administrateur
1. Sur le site : **Connexion → Créer mon compte** (e-mail réel du responsable principal, mot de passe fort). Confirmez l'e-mail.
2. Supabase **SQL Editor** : ouvrez `03_premier_administrateur.sql`, remplacez l'adresse, **Run**.
3. Allez sur **`/admin/`**, connectez-vous. Ouvrez **Sécurité du compte** → **activez la double authentification**.
4. **Rôles et accès** : attribuez des rôles aux autres responsables (ils doivent d'abord créer leur compte).

### Étape 5 — Remplir le site
Administration → **Paramètres du site** (e-mail, téléphone, réseaux — *seulement les comptes qui existent vraiment*), **Organisation** (ajouter les responsables **officiellement désignés**), **Actualités**, **Ressources**, **FAQ**…

---

## 5. À savoir avant d'ouvrir au public (honnêteté technique)

| Sujet | Ce qu'il faut savoir | Que faire |
|---|---|---|
| **E-mails d'authentification** | L'envoi par défaut de Supabase est limité (quelques e-mails/heure) : les confirmations de compte risquent de ne pas partir si beaucoup de gens s'inscrivent. | Brancher un SMTP gratuit (Brevo, Resend…) : *Authentication → SMTP Settings*. **À faire avant le lancement.** |
| **Notifications** | Les notifications sont **dans l'espace membre** (cloche) et en temps réel dans l'admin. Le site n'envoie pas d'e-mails/SMS de notification. | Ajout possible plus tard (Edge Function + SMTP). |
| **Réponse aux messages** | Le bouton « Répondre par e-mail » ouvre la messagerie du responsable ; la réponse est ensuite **consignée** dans l'historique du message. | Envoi direct depuis le site = évolution possible. |
| **Projet Supabase gratuit** | Il se met en **pause après 7 jours sans activité** et n'a **pas de sauvegarde automatique** sur l'offre gratuite. | Garder le site actif ; exporter la base régulièrement (*Database → Backups* / `pg_dump`) ; passer à l'offre Pro (~25 $/mois) pour sauvegardes quotidiennes + restauration quand la communauté grandit. |
| **CAPTCHA** | Les formulaires sont protégés (pot de miel, délai, quotas serveur). Ne pas activer le CAPTCHA de Supabase Auth sans demander l'ajout du jeton côté site. | Évolution possible (Cloudflare Turnstile). |
| **Textes juridiques** | `confidentialite.html`, `conditions.html`, `statuts.html`, `reglement-interieur.html` sont des **modèles**. | Faire valider/adapter par la Direction (et un juriste), puis publier les vrais statuts. |
| **Dons en ligne** | Non activés (conformément au cahier des charges). Aucune coordonnée bancaire n'est affichée. | À ajouter après vérification juridique/financière. |
| **MFA obligatoire** | La double authentification est **disponible** pour tous les comptes. Pour l'**exiger** pour tout le personnel : `supabase/04_optionnel_exiger_mfa.sql` (après activation par chacun). | Recommandé. |
| **Responsables / partenaires** | Rien n'est inventé : l'équipe, les partenaires et les réseaux sociaux sont **vides** tant que vous ne les ajoutez pas. | N'ajouter un partenaire qu'avec son accord ; un responsable qu'après désignation officielle. |

---

## 6. Personnaliser

- **Couleurs** : variables `:root` en haut de `css/style.css` (`--navy-900`, `--amber`…).
- **Textes des pages fixes** : modifiez directement les fichiers `.html` (ex. `a-propos.html`).
- **Contenus dynamiques** (actualités, FAQ, organigramme, rôles…) : toujours depuis l'administration.
- **Mise en forme des textes longs** (actualités, FAQ) : `## Titre`, `### Sous-titre`, `- liste`, `**gras**`, `*italique*`, `[lien](https://…)`.

## 7. Dépannage rapide

| Symptôme | Cause probable |
|---|---|
| Encadrés « base de données non connectée » | `js/config.js` non rempli. |
| « Accès refusé » sur /admin | Le script `03_premier_administrateur.sql` n'a pas été exécuté avec la bonne adresse (ou MFA exigée mais non activée). |
| Le membre ne voit pas sa carte | Son compte doit utiliser **la même adresse e-mail** que la demande acceptée, et être **confirmé**. |
| Images d'actualités qui ne s'affichent pas | Vérifiez l'espace de stockage `media` (public) dans Supabase → Storage. |
| Le site semble « figé » après une mise à jour | Videz le cache du navigateur (Ctrl+F5). |

*Site réalisé par Africa Golden Digital pour GCU-BÉNIN.*

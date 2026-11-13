# Interface « User » — diagnostic et conception

*Assemblage ingénierie · application timesheetai.assemblage.net · document de travail du 12/11/2026*

> Ce document est un **livrable de conception**. Aucun code n'a été modifié et aucune
> donnée Airtable n'a été créée, modifiée ou supprimée pour le produire.
> Les hypothèses sont signalées par **[H]** et les points non vérifiés par **[?]**.

## Décisions du 12/11/2026 (après relecture de ce document)

| Sujet | Décision | Effet dans le code |
|---|---|---|
| Architecture (Q13, § 5.1) | **Migration vers Next.js**, sur le modèle de portfolio.assemblage.net | Next.js 16, App Router, TypeScript. L'outil Admin historique est conservé tel quel sous `/admin/import`. |
| Authentification (Q10) | Google OAuth ouvert à **tout compte @assemblage.net**, rôles Admin et User | Connexion Google directe (pas de Supabase) ; Admin = `ADMIN_EMAILS` (repli `ALLOWED_EMAILS`). |
| Mails (Q2, § 5.5) | **Copier-coller conservé** pour l'instant ; envois individuels plus tard | Aucun service d'envoi ajouté. |
| États clôturés (Q1) | Les **4 états** : Terminé, Annulé, Interrompu, Livré | `ETATS_CLOS`. |
| Lundi de Pentecôte (Q3) | **Travaillé** | Retiré des fériés (application et outil historique). |
| Absences (Q4) | Flux .ics Payfit ; **absences validées uniquement**, sans motif ; télétravail non déclaré dans Payfit | Créneaux d'absence pré-remplis et verrouillés. |
| Plan Airtable (Q5) | Team : 50 000 enregistrements/base, **100 000 appels API/mois** | Cache des référentiels, file d'appels, lots de 10. |
| Balance (Q6) | Coût consommé = champ Affaire **« Coût 26/27 »** ; coût journalier = Collaborateur « Cout » | Balance = Marché PI − Coût 26/27 ; en jours = balance ÷ coût journalier du collaborateur. Champ à faire évoluer à chaque exercice (`lib/config.ts`). |
| Codes analytiques (Q7) | Nomenclature 2026 active depuis novembre 2026 | Outil historique : P001-P002 → Prospection & communication, G001-G002 → Gestion & RH, R001-R002 → R&D-Formation, R003-R006 → IA. Les rollups Airtable de Collaborateur restent à corriger. |
| CONGE PE (Q8) | Code **propre à Pierre Esselinck** (« PE »), qui ne pose pas ses absences dans Payfit : ce n'est **pas** un code d'absence général (précision du 13/11/2026) | CONGE PE est une affaire ordinaire du sélecteur, saisie à la main. Les absences Payfit des salariés sont affichées, verrouillées et comptées pour la complétude, mais **ne sont pas écrites** dans Tps W. |
| Mes affaires (Q9) | Affaires où l'on est **Chef·fe de projet (CDP) ou Manager** | Correspondance sur le prénom. |
| Écarts E1-E9 (Q11) | Création autorisée | Créés le 12/11/2026 : Collaborateur.Email / Nom / ID Payfit ; Tps W TEST.Confirmation clôture / Confirmation jour non ouvré / Confirmée le / Source / Saisi par / Modifié le / Clé créneau ; tables « Validation mensuelle », « Commentaires temps », « Paramètres timesheet ». |
| Date future (Q12) | Autorisée sur **tout le mois courant** | Mois futurs verrouillés pour les Users. |
| Contrôles 2 à 5 | Propositions du § 5.4 retenues par défaut | Complétude bloquante à la soumission ; confirmation week-end / férié ; absences verrouillées ; conflit absence ↔ saisie bloquant à la soumission. |

## 0. Lecture préalable

| Source | Lu | Remarque |
|---|---|---|
| `index.html` (2 601 lignes) | intégralement | toute l'application Admin : HTML, CSS et JS dans un seul fichier |
| `login.html`, `middleware.js` | intégralement | |
| `api/_session.js`, `api/me.js`, `api/airtable.js`, `api/calendar.js`, `api/auth/callback.js`, `api/auth/logout.js` | intégralement | |
| `README.md`, `.env.example`, `vercel.json`, `package.json`, `.gitignore` | intégralement | |
| Historique git (9 commits, mai → août 2026) | messages lus | |
| Export Payfit `time-tracking-export-2026-9.xlsx` | intégralement | 69 feuilles : Avertissement, Synthèse, Détails, puis 1 feuille par code projet |
| Capture Payfit « Suivi du temps de travail » (novembre 2026) | oui | |
| Base Airtable `app7d0qSY8L7om0Ke` | schéma + échantillons, via le connecteur Airtable, en lecture seule | voir phase 2 |
| Documentation Payfit developers.payfit.io | via recherche web | voir phase 3 |

Aucun fichier ignoré. Le dossier `.claude/` (configuration locale de l'outil) n'a pas été lu : il ne fait pas partie de l'application.

---

## 1. Diagnostic de l'application existante

### 1.1 Ce que l'application est réellement

Le prompt de cadrage suppose une application **Next.js**. Ce n'est **pas** le cas :

- **Aucun framework, aucune étape de build.** Une page statique `index.html` (≈ 2 600 lignes : HTML + CSS + JS vanilla) et une page `login.html`.
- **Fonctions serveur Vercel « nues »** dans `api/` (Node, signature `(req, res)`), plus un `middleware.js` de type *Vercel Routing Middleware* (API Web standard, pas `next/server`).
- **Dépendances serveur** : `jose` (JWT) et `@vercel/functions`. **Navigateur** : SheetJS (CDN), Open Sans, Google Identity Services.
- Pas de routeur : la navigation est un affichage/masquage de blocs `.step` dans la page.

Conséquence pour la conception : on peut soit **rester sans framework** (cohérent avec l'existant, zéro risque de régression sur le build), soit **migrer vers Next.js** (plus confortable pour une interface User riche, mais réécriture et risque). Voir phase 5, § Architecture.

### 1.2 Fonctionnement de la partie Admin aujourd'hui

C'est un **outil d'import manuel**, exécuté dans le navigateur de l'Admin :

1. L'Admin dépose l'export Excel Payfit (onglet `Détails`). Le calendrier d'absences Payfit se charge automatiquement via `/api/calendar`.
2. **Analyse** : lecture Excel → enregistrements, chargement des tables Collaborateur et Affaire, résolution des liens, moteur de règles, bilan.
3. **Contrôles** : rapport par salarié, exportable en « Copier pour email » (HTML collé à la main dans un mail), PDF (impression navigateur) ou Excel.
4. **Bilan du mois** (document interne, coûts nominatifs).
5. **Import Airtable** : `POST` par lots de 10 dans « Temps W », `typecast: true`, 150 ms entre lots.

Tout le calcul (règles, bilan) est fait **côté navigateur**, à partir du **fichier Excel** — pas à partir d'Airtable.

### 1.3 Sélection de la table cible

**Valeurs en dur** dans `index.html` (l. 750-753) :

```js
const BASE_ID       = 'app7d0qSY8L7om0Ke';
const TABLE_TPS_W   = 'tble4Su3mWGgez7mj';   // Temps W (production)
const TABLE_COLLAB  = 'tblfv2fUdCrKOVjMO';
const TABLE_AFFAIRE = 'tblOT9d8lAnOS50wK';
```

Aucune variable d'environnement. Le relais `/api/airtable?path=<base>/<table>` transmet **n'importe quel chemin** : la table est choisie par le navigateur.

### 1.4 Les contrôles automatisés (moteur `runRules`, `index.html` l. 1365-1545)

Correspondance entre la numérotation du prompt et les lettres du code :

| Prompt | Code | Logique exacte | Données |
|---|---|---|---|
| 1. Affaire clôturée | **E** | `Etat interne` ∈ {**Terminé, Annulé, Interrompu, Livré**}. Regroupé par salarié × affaire : « N saisies, du … au …, X j au total ». | Excel (code projet) + Airtable Affaire (`fldlMVWpA50MXa66M` Etat interne, `fldtSnDRkwS4dkcsa` nom). Ne tourne que si les référentiels Airtable sont chargés. |
| 2. Saisie incomplète | **C** | Pour chaque **jour ouvré** du mois (hors week-end et fériés) et chaque salarié présent dans l'export : `temps déclaré + fraction d'absence ICS < 1`. Journée vide → regroupée en plages de jours ouvrés consécutifs. Journée partielle → message demi-journée (avec le créneau manquant) ou fraction. | Excel + ICS Payfit |
| 3. Weekend / jour férié | **B** | Ligne dont le jour est samedi, dimanche ou férié (calcul local, § 1.7). Une ligne par saisie, pas d'agrégation. | Excel |
| 4. Projet manquant | **A** | `Code projet` vide. | Excel |
| 5. Travail pendant une absence | **D** | Jour ouvré où `déclaré + absence > 1` **et** un créneau saisi coïncide avec un créneau d'absence ICS. | Excel + ICS |

**Écarts avec la liste du prompt :**

- Le contrôle 1 couvre **4 états**, pas 2 : Terminé, Interrompu, **Annulé** et **Livré** (« Livré » ajouté par le dernier commit). La règle métier du prompt (« Terminé » ou « Interrompu ») doit être alignée → **question ouverte Q1**.
- Le contrôle 3 n'est **pas agrégé** (une ligne par saisie), contrairement à E et C.
- Le contrôle D ne s'évalue que sur les **jours ouvrés** : du temps posé un samedi pendant une absence n'est pas signalé en D (il l'est en B).
- `CONGE PE` est compté comme couverture par C mais exclu du bilan.

**Contrôles présents dans le code mais absents de la liste** — les « garde-fous structurels », affichés à l'Admin uniquement, jamais diffusés :

- temps différent de 0,5 ou 1 ;
- incohérence temps ↔ créneau (0,5 j sans créneau, ou 1 j avec créneau) ;
- **doublon** salarié × jour × créneau ;
- date hors de la période analysée.

Plus, à l'étape Liens : collaborateur introuvable (`Prénom - exercice`), affaire introuvable, champ obligatoire vide.

**Période analysée** : le mois le plus représenté dans l'export (`dominantPeriod`), modifiable à la main.

**Déclencheur** : **100 % manuel**. Il n'y a **aucun cron**, aucune fonction planifiée (`vercel.json` n'a pas de `crons`).

### 1.5 Le « mail mensuel » : il n'y a pas de service d'envoi

Le prompt mentionne un service d'envoi de mails. **Il n'existe pas.** Le bouton « 📋 Copier pour email » (`copyEmail`, l. 2188) place un **HTML à styles inline** dans le presse-papier ; l'Admin le **colle lui-même** dans Gmail/Outlook et l'envoie à tous. Le texte invite à « corriger directement dans Payfit ».

Conséquences :

- **Aucun quota ni expéditeur** à connaître aujourd'hui.
- Passer à des **envois individuels automatiques** demande d'**introduire** un service. Options (à arbitrer, **Q2**) :
  - **API Gmail** avec un compte de service Google Workspace et *délégation au niveau du domaine* (expéditeur `@assemblage.net`, quotas Workspace d'environ 2 000 mails/jour/utilisateur **[?]** à vérifier sur la console d'administration) ;
  - **Resend / Postmark / SendGrid** avec un domaine d'envoi vérifié (DNS SPF/DKIM sur `assemblage.net`) ;
  - **solution sans service** : un lien `mailto:` par salarié, prérempli, que l'Admin ouvre et envoie (zéro configuration, mais manuel).

### 1.6 Intégration Payfit existante

- **Ce n'est pas l'API Customer.** L'application lit le **flux iCalendar d'absences** de Payfit : URL secrète `https://api.payfit.com/absences/calendar/<uuid>` (variable `PAYFIT_ICS_URL`), sans authentification (secret porteur).
- **Relais** `/api/calendar` (Payfit ne renvoie pas d'en-tête CORS). Cache mémoire de 5 min par instance, repli sur la version périmée en cas de panne ou de 429. Le commentaire du code mentionne une limite de **100 appels par fenêtre** **[?]**.
- **Fréquence** : au chargement de la page Admin.
- **Données lues** : `SUMMARY` (« Absence - Prénom NOM »), `DTSTART`/`DTEND` (dates pleines, fin exclusive), et **les demi-journées uniquement dans `DESCRIPTION`** (« (matin) », « from: … (après-midi) / to: … (matin) »). Pas de type d'absence, pas de statut, pas d'identifiant salarié : **le rapprochement se fait sur le nom normalisé** (sans accents, majuscules).
- La clé API Customer `time:read` mentionnée dans le prompt **n'est utilisée nulle part**. Voir phase 3.

### 1.7 Jours fériés

- **Emplacement** : `index.html`, fonctions `paques()` et `feriesFR()` (l. 896-931), cache `_ferCache`.
- **Format** : objet `{ 'YYYY-MM-DD': 'libellé' }`.
- **Années couvertes** : **toutes** — c'est un calcul (algorithme de Meeus pour Pâques), pas une liste. 11 jours fériés de métropole : 1ᵉʳ janvier, lundi de Pâques, 1ᵉʳ mai, 8 mai, Ascension, lundi de Pentecôte, 14 juillet, 15 août, Toussaint, 11 novembre, Noël.
- **Mise à jour** : aucune nécessaire. Limite : le **lundi de Pentecôte** est compté férié, alors qu'il est souvent « journée de solidarité » travaillée **[?] Q3**. Aucun jour d'Alsace-Moselle (cohérent pour Paris).
- La capture Payfit montre le 1ᵉʳ novembre marqué « Jour férié » : Payfit a sa propre source, l'application aussi.
- Pour l'interface User, cette fonction doit être **extraite dans un module partagé** (navigateur + serveur) plutôt que copiée.

### 1.8 Authentification Google et session

- **Google Identity Services** (bouton « Se connecter avec Google »), jeton d'identité vérifié côté serveur (`jose`, clés publiques Google, `aud` = `GOOGLE_CLIENT_ID`).
- **Restriction au domaine** : oui, côté serveur, via `ALLOWED_HD=assemblage.net` (vérifié sur le site de production : `/api/me` renvoie `domaine: "assemblage.net"`) **et** liste blanche `ALLOWED_EMAILS`.
- **Session** : JWT HS256 signé avec `SESSION_SECRET`, cookie `tpsw_session` HttpOnly, Secure, SameSite=Lax, 12 h. La liste blanche est **revérifiée à chaque requête** (middleware et `lireSession`).
- **Tout le site** est fermé sans session (middleware), sauf `/login`, `/api/auth/*`, `/api/me`.

### 1.9 Rôles

**Il n'existe aucune notion de rôle.** Toute personne présente dans `ALLOWED_EMAILS` a accès à tout, y compris le bilan avec les coûts nominatifs et l'import vers la table de production. De fait, **tout utilisateur autorisé est Admin**.

Proposition (détaillée en phase 5) :

- `ADMIN_EMAILS` (variable d'environnement) = les Admins ;
- tout compte `@assemblage.net` **présent dans la table Collaborateur** (email) = User ;
- le rôle est écrit dans le JWT **et** revérifié côté serveur à chaque appel, comme la liste blanche aujourd'hui.

### 1.10 Secrets

| Secret | Stockage | Exposé au navigateur ? |
|---|---|---|
| `AIRTABLE_TOKEN` | variable Vercel | non, utilisé par `/api/airtable` uniquement |
| `PAYFIT_ICS_URL` | variable Vercel | non, utilisé par `/api/calendar` uniquement |
| `SESSION_SECRET` | variable Vercel | non |
| `GOOGLE_CLIENT_ID` | variable Vercel, renvoyé par `/api/me` | oui, **par conception** (non secret) |
| Clé API Payfit Customer | **inexistante dans le projet** | — |

En mode local (`file://`), le PAT Airtable et l'URL ICS sont saisis par l'utilisateur et stockés dans son `localStorage` : acceptable pour un usage local, à **retirer** une fois l'interface User en place.

**Risque majeur pour l'interface User** : `/api/airtable` est un **relais générique**. Tout utilisateur connecté peut lire et écrire **n'importe quelle table** de la base avec le token serveur, y compris les coûts journaliers, et **supprimer** des enregistrements (`DELETE` est transmis). Aujourd'hui seuls des Admins de fait y ont accès ; **dès qu'un User se connecte, ce relais doit être réservé aux Admins**, et l'interface User doit passer par des **endpoints métier dédiés** qui filtrent les champs côté serveur.

### 1.11 Réutilisable et risques de régression

**Réutilisable tel quel** : authentification Google, session, middleware, relais Payfit et son parseur ICS (à déplacer côté serveur), calcul des jours fériés, charte (couleurs, Open Sans, composants carte/badge), le moteur de règles (sa logique, à brancher sur des données Airtable au lieu de l'Excel).

**Risques de régression Admin** :

1. Tout dans un fichier de 2 600 lignes : ajouter l'interface User **dans** `index.html` rendrait la page illisible et ferait charger aux Users le code Admin (dont les libellés de coût). → **pages séparées**.
2. Restreindre `/api/airtable` aux Admins : sans effet tant que les Admins actuels sont dans `ADMIN_EMAILS` (à faire **au même déploiement** que l'ouverture aux Users).
3. Le moteur de règles lit l'**Excel**. Après la bascule, il n'y aura plus d'export : les contrôles Admin devront lire **« Temps W »** (phase 5).
4. Les codes non facturables du bilan (`CAT_NF`) sont **`AXXX`, `RDF`, `IA`, `A000`**, alors que l'export de septembre 2026 utilise **`P001`, `R001`, `IA`, `G001`**. Le bilan classe donc aujourd'hui P001/R001/G001 comme **facturables** — confirmé en phase 2 (§ 2.6) : nouvelle codification depuis octobre 2026. C'est un défaut existant, indépendant de l'interface User, mais qui fausserait la balance par collaborateur.

---

## 2. Diagnostic Airtable

*Lecture du schéma et d'échantillons via le connecteur Airtable, sans aucune écriture. Base `app7d0qSY8L7om0Ke`.*

### 2.1 Tables

| Table | id | Rôle |
|---|---|---|
| **Affaire** | tblOT9d8lAnOS50wK | affaires **et** codes hors affaire (Pôle = « Autre ») |
| **Collaborateur** | tblfv2fUdCrKOVjMO | **une fiche par personne et par exercice** (« Pierre - 26/27 »), porte le coût journalier — 55 fiches |
| **Tps W** | tble4Su3mWGgez7mj | temps, production — **10 483 enregistrements** |
| **Tps W TEST** | tbl7GeXNHASbjN9ka | bac à sable — 10 037 enregistrements (copie arrêtée au 30/09/2026) |
| Facture, Devis, Paiement, ST/CT, Tableau de bord, Sync CRM, Facture temporaire | | hors périmètre |

- Pas de table Pôle, Codes hors affaire, Coûts, Statuts : ce sont des listes déroulantes ou des enregistrements d'Affaire.
- **Aucune automatisation** ne porte sur Tps W ni Collaborateur.
- **Plan Airtable non visible** par le connecteur **[?] Q5**.
- La vue `viwuQiFy4vuc4HoPG` citée comme vue de « Temps W » est une vue filtrée (« Vue pour navigation libre », filtre SA_NEW ELIM). La vue d'import est **« Grid Import » `viwZcDpUEENeZNUsF`** (TEST : `viwSOZSEZiZ941Wqw`).

### 2.2 Schéma « Tps W » — champs utiles

| Champ | id | Type | Rempli par l'import |
|---|---|---|---|
| ID du collaborateur | fldhbucYXDPn7Zlpr | texte | oui — id Payfit à 24 hex **[?]** |
| Nom du collaborateur | fldQkWAaZJBRN27JL | liste | oui |
| Prénom du collaborateur | fldLGNJpFVe2ps4rX | liste | oui |
| Jour | fldJRo4by8KQCGQiv | date `YYYY-MM-DD` | oui |
| Code projet | fldmoLZ3HtivN01Cs | texte | oui |
| Nom du projet | fld4UpyuG9ILu9jAL | liste (~230 options) | oui |
| Temps travaillé | fldil04cXYHbHkPKm | nombre | oui : **0,5 ou 1** |
| Unité | fldzliKp1juKBP3F1 | liste | oui : « jours » |
| **Heure de début** = le créneau | flduwfXxQrcETpZaB | liste : **Matinée / Après-midi** | oui si 0,5 j, vide si 1 j |
| Collaborateur (link) | fldxbwDTTZvXhbPtv | lien → Collaborateur | oui (record id de la fiche « Prénom - exercice ») |
| Affaire (Link) | fldl5Hmib4WzWKha0 | lien → Affaire | oui (record id) |
| Matricule, Heure de fin, Mois | | | toujours vides |
| Exercice, ID Collab-Exercice, Nom Projet complet, MM/AA, Calculation | | formules | — |
| Cout (lookup), **Coût** = Cout × Temps, Pôle (lookup) | | calculés | — |

### 2.3 Temps W TEST est-il conforme ?

**Oui pour la structure** : mêmes 22 champs, mêmes types, mêmes formules. Écarts :

1. **~19 options manquantes** dans « Nom du projet » (AO & PROSPECTION, RH, AUTOFORMATION, IA GENERAL, APP AI CHANTIER, …). Sans incidence si l'écriture se fait avec `typecast: true` (l'option est créée), mais cela **modifie le schéma TEST** à la première écriture.
2. **TEST n'est pas isolé** : ses liens pointent vers les **vraies** tables Collaborateur et Affaire (champs inverses « Copie de Tps W »). Les balances financières n'utilisent pas ces champs inverses : **les tests ne faussent pas les coûts**, mais les fiches Affaire et Collaborateur afficheront des liens vers les enregistrements de test.

### 2.4 Contrat de données de l'export manuel

Constaté sur l'export de septembre 2026 (455 lignes) **et** sur Tps W :

- **Granularité** : 1 enregistrement **par demi-journée** (0,5 j + créneau Matinée/Après-midi), **ou** 1 enregistrement **par journée entière** quand les deux créneaux portent sur la même affaire (1 j, créneau vide). Payfit fusionne ; septembre 2026 : 298 demi-journées, 157 journées.
- Jamais 1 j avec un créneau. 235 saisies anciennes à 0,5 j sans créneau (historique).
- Unité toujours « jours » (32 anciennes saisies « heures » : erreurs d'import).
- **Le code projet est un texte libre**, mais **c'est le lien `Affaire (Link)` qui compte** : le texte n'a aucun effet sur les balances. Les libellés diffèrent souvent (« TCHAD_SAN » pour l'affaire « A049D_1_TCHAD_PASST 3_BDC1 »). Un code mal saisi existe aussi (`" A032D_2"` avec une espace).
- **Le collaborateur est lié par sa fiche d'exercice**, choisie d'après le prénom et la date (`Prénom - 26/27`). **Sans ce lien, le coût vaut 0.**

**Contrat retenu pour l'application [H]** : l'application écrit **toujours une demi-journée par enregistrement** (0,5 j + créneau). Cette forme existe déjà massivement, est lue par toutes les formules et règles, et rend chaque créneau modifiable indépendamment. Elle remplit : ID du collaborateur (si connu), Nom, Prénom, Jour, Code projet, Nom du projet, Temps = 0,5, Unité = jours, Heure de début, Collaborateur (link), Affaire (Link).

### 2.5 Calculs existants

- **Coût de revient d'une saisie** : `Coût = lookup(Collaborateur.Cout) × Temps travaillé` — **entièrement calculé**.
- **Changement de coût journalier** : la valeur n'est **pas figée**. Modifier le Cout d'une fiche recalcule **toutes** les saisies liées à cette fiche. Comme il y a une fiche par exercice, l'effet est borné à l'exercice. Les fiches sans Cout (ex. « Amaury - 24/25 ») donnent un coût nul.
- **Coût consommé d'une affaire** : `Coût global` (rollup de Tps W.Coût), plus `Coût 24/25 / 25/26 / 26/27`.
- **Balance financière « Marché PI − coût consommé » : ce champ n'existe pas.** Les plus proches : `Rentabilité globale` (= CA − ST − frais − Coût global − CA des exercices sans suivi des temps **[?]**), `Rentabilité 25/26`, `26/27`, `RAF AI` (reste à facturer), `Marge`.
- **Balance journalière : aucun champ trouvé.**
- → Le prompt indique que ces deux balances « existent déjà, à lire sans recalculer ». **Ce n'est pas le cas — Q6.**

### 2.6 Codes hors affaire et états

- **Codes hors affaire** : enregistrements de la table **Affaire** avec **Pôle = « Autre »** (13) : G001 GESTION, G002 RH, P001 AO & PROSPECTION, P002 COMMUNICATION, R001 FORMATION, R002 AUTOFORMATION, R003 IA, R004 App Portfolio, R005 App AI chantier, R006 App airtable, **CONGE PE**, AXXX_CT, A00. Pas de champ « type ».
- **Nouvelle codification depuis octobre 2026** : les saisies jusqu'en septembre utilisent A000 / AXXX / RDF ; G001 / P001 / R001 ensuite (champ `Clef Suivi Tps` = ancien code). Or :
  - les rollups de Collaborateur (`Gestion`, `Prospection`, `RDF 25/26`, `% Non productif`) ne filtrent **que les anciens codes** ;
  - le bilan de l'application (`CAT_NF`) aussi.
  → **Depuis octobre, le temps G001/P001/R001 est compté comme facturable** dans le bilan Admin et absent du % non productif Airtable. Défaut existant, à corriger indépendamment — **Q7**.
- **États** (`Etat interne`) : Etude, AO, Chantier, Livré, Terminé, Annulé, Interrompu, En Cours. Un second champ `État avancement` existe (Concours, En étude, …, En pause). La répartition « en cours / terminées » se fera sur **`Etat interne`** **[H]**.

### 2.7 Liens et clés manquants

| Besoin | Existe ? | Constat |
|---|---|---|
| Lien collaborateur ↔ affaire (pour « Mes affaires ») | **non** | `Manager` (sélection d'un prénom) et `CDP` (sélection multiple de prénoms) dans Affaire ; le seul lien réel passe par les saisies |
| Email du collaborateur (lien compte Google) | **non** | |
| Identifiant Payfit | partiel | dans Tps W (texte), pas dans Collaborateur |
| Statut de validation mensuel | **non** | |
| Unicité collaborateur × date × créneau | **non** | Airtable ne sait pas l'imposer ; l'application devra le garantir |
| Rollups par personne dans Affaire (champ `Pierre`, `Malo`…) | oui | filtrés sur un **prénom** : chaque arrivée impose d'ajouter un champ à la main |

### 2.8 Contraintes techniques Airtable

- **5 requêtes/s par base** ; au-delà, HTTP 429 et 30 s de pénalité. Avec ~15 utilisateurs, à absorber par un **cache serveur** des référentiels (Affaire, Collaborateur : quelques centaines d'enregistrements, 10 min) et une file de réécriture.
- **10 enregistrements max par écriture** ; une semaine complète = 10 créneaux = **1 requête**.
- **Upsert** natif : `PATCH` avec `performUpsert.fieldsToMergeOn` ; les champs de fusion ne peuvent pas être des champs calculés **[?]** — d'où une écriture par record id (lecture puis mise à jour) plutôt qu'un upsert.
- **Pas de transactions** : une semaine écrite en 2 lots peut être à moitié enregistrée. L'application relit et affiche l'état réel après chaque enregistrement.
- **Limite d'enregistrements** : plan inconnu. Volume prévisible ≈ 15 personnes × 2 créneaux × ~220 j ≈ **6 600 enregistrements/an**, plus que l'existant (Payfit fusionne les journées). Avec 10 483 aujourd'hui, la limite d'un plan Team (50 000/base **[?]**) serait atteinte en ~6 ans.
- **Un token API voit tous les champs** (y compris `Cout`) : le filtrage User doit se faire **côté serveur**, en ne demandant à Airtable que les champs autorisés (`fields[]`) et en ne renvoyant que ceux-là.

---

## 3. Diagnostic de l'API Payfit

### 3.0 Décision : le flux calendrier (.ics) est conservé, pas d'API

**Décidé le 12/11/2026** : l'application continue de lire les absences par le **flux iCalendar Payfit** (variable `PAYFIT_ICS_URL`, déjà en place), et non par l'API. Aucune clé API n'est créée.

Flux vérifié le 12/11/2026 (structure seulement) :

- 556 événements, du 25/07/2021 au 15/03/2027 ; propriétés `UID`, `SUMMARY`, `DTSTART`, `DTEND`, `DESCRIPTION` uniquement.
- `SUMMARY` toujours « Absence - Prénom NOM ».
- **Demi-journées bien encodées** dans `DESCRIPTION`, sous les formes déjà gérées par le parseur existant (`parseICS`) :

| Forme | Nombre | Signification |
|---|---|---|
| `from: <date>` / `to: <date>` (sans moment) | 260 | plage de journées entières |
| description vide | 199 | une journée entière |
| `<date> (après-midi)` | 47 | après-midi seul |
| `<date> (matin)` | 36 | matin seul |
| `from: <date> (matin)` / `to: <date> (matin)` | 11 | plage finissant le matin |
| `from: <date> (après-midi)` / `to: <date> (après-midi)` | 3 | plage commençant l'après-midi |

Conséquences pour la conception :

- **Pas de type d'absence ni de statut** dans le flux : toute absence affichée est traitée comme **validée** **[H]** (les demandes en attente n'y figurent probablement pas — **[?]**). Le libellé affiché sera « Absence (Payfit) ». Avantage RGPD : la nature de l'absence (maladie…) n'est jamais lue.
- **Délai** : Payfit indique une mise à jour du flux « dans les 24 heures ». Une absence posée le jour même peut ne pas encore apparaître : c'est un **cas résiduel** du contrôle 5, traité par le contrôle quotidien.
- **Rapprochement par nom** (« Prénom NOM » normalisé, sans accents) : la table Collaborateur ne contient que le **prénom**. Il faut donc ajouter le **`Nom`** dans Collaborateur (en plus de l'Email, écart E1).
- **Secret porteur** : l'URL reste exclusivement dans la variable Vercel, jamais dans le dépôt (public) ni dans le navigateur.
- **Lecture côté serveur** : le parseur `parseICS` est déplacé dans un module serveur ; l'endpoint User ne renvoie que **les créneaux d'absence du salarié connecté** (jamais le calendrier de toute l'entreprise). Cache 10 min ; le flux pèse ~556 événements.

Le reste de cette section décrit l'API Payfit pour mémoire, si un besoin futur (type d'absence, statut « en attente ») le justifiait.

*Sources : developers.payfit.io, consulté le 12/11/2026 (pages citées ci-dessous). Rien ici n'a été testé contre l'API réelle : aucune clé n'est disponible dans le projet.*

### 3.1 Ce qui est utilisé aujourd'hui, ce qui existe

| | Flux iCalendar (utilisé) | API Payfit « Partner API » avec clé entreprise (non utilisée) |
|---|---|---|
| Accès | URL secrète, sans authentification | `Authorization: Bearer <clé>`, clé créée par un admin Payfit (app.payfit.com → Intégrations → API), scopes choisis à la création — [auth](https://developers.payfit.io/docs/authentication-via-api-key.md) |
| Base | `api.payfit.com/absences/calendar/<uuid>` | `https://partner-api.payfit.com` ; `companyId` obtenu par `POST https://oauth.payfit.com/introspect` |
| Identifiant salarié | **aucun**, nom en clair dans `SUMMARY` | `contractId` sur chaque absence |
| Demi-journée | texte libre dans `DESCRIPTION` (« (matin) ») | `startDate.moment` / `endDate.moment` ∈ {`beginning-of-day`, `middle-of-day`, `end-of-day`} |
| Type d'absence | non | oui : `fr_conges_payes`, `fr_rtt`, `fr_maladie_ordinaire`, … |
| Statut | non (absences validées seulement **[?]**) | `approved`, `pending_approval`, `declined`, `cancelled`, `pending_cancellation` |
| Débit | ~100 appels par fenêtre **[?]** | 50 req/s en lecture — [rate limits](https://developers.payfit.io/docs/rate-limits.md) |

La documentation ne distingue pas d'« API Customer » : la clé entreprise s'utilise sur la **Partner API**.

### 3.2 Endpoints nécessaires (lecture seule)

1. **Absences** — `GET /companies/{companyId}/absences` ([réf.](https://developers.payfit.io/reference/get_absences.md)), scope `time:read`.
   Paramètres : `beginDate`, `endDate` (chevauchement), `status` (défaut `approved`, `all` accepté), `contractId`, `maxResults` ≤ 50, `nextPageToken`. Pagination par jeton (`meta.nextPageToken`, null en dernière page **[?]**).
2. **Contrats** — `GET /companies/{companyId}/contracts` ([réf.](https://developers.payfit.io/reference/get_contracts.md)), scope `contracts:read` : `contractId` → `collaboratorId`.
3. **Collaborateurs** — `GET /companies/{companyId}/collaborators` ([réf.](https://developers.payfit.io/reference/get_collaborators.md)), scope `collaborators:read` (+ `collaborators:contracts:read` pour la liste des contrats) : `emails[{email, type: professional}]`, `firstName`, `lastName`.

**Il n'existe aucun endpoint de suivi du temps détaillé** (ni lecture, ni écriture) : seul `GET /contracts/time?date=YYYYMM` renvoie un total mensuel par contrat. **Il n'existe aucun endpoint de jours fériés.** La source locale (§ 1.7) reste donc la seule.

L'API permet de **créer** et **supprimer** des absences (`time:write`). **La clé à créer ne doit pas avoir ce scope** : c'est la garantie technique que l'application ne touche jamais aux absences (paie).

### 3.3 Ce qui manque pour le pré-remplissage

- **Sémantique de `moment` non documentée** : pour une absence d'un après-midi, on attend `start = middle-of-day`, `end = end-of-day`, mais rien ne le garantit, ni le caractère inclusif de `endDate.date`. **À valider sur 3 absences réelles** (matin seul, après-midi seul, plage commençant un après-midi) avant d'écrire le code — **Q4**.
- **Statuts à retenir** : `approved` pré-remplit et verrouille. `pending_approval` : proposition — **affiché mais non bloquant** (badge « absence en attente »), compté dans la complétude **[H]**. `declined` / `cancelled` : ignorés.
- **Correspondance Payfit ↔ Airtable** : absence → `contractId` → collaborateur → email professionnel → compte Google → collaborateur Airtable (par email, voir phase 2). Ne plus dépendre du nom.
- **L'« ID du collaborateur » de l'export Excel** (ex. `610a9608c9bd5c5c4bc04662`, 24 hexadécimaux) n'est pas forcément l'`id` collaborateur de l'API (exemples en UUID dans la doc) — **[?]**, à comparer sur données réelles.

### 3.4 Fréquence de synchronisation proposée

Volume : ~15 salariés, quelques dizaines d'absences par mois → 1 à 3 pages de 50.

- **À l'ouverture d'un mois** par un User ou un Admin : lecture des absences du mois (fenêtre `beginDate`/`endDate`), **cache serveur 10 min** partagé par instance. Coût négligeable au regard des 50 req/s.
- **Index contrat ↔ email** : recalculé au plus une fois par heure.
- **Cron Vercel quotidien** (ex. 6 h) pour les contrôles détectifs (absence posée après la saisie, § phase 5).
- **Webhooks** : ils existent mais demandent une activation par Payfit et **aucun événement d'absence n'est documenté** ([webhooks](https://developers.payfit.io/docs/payfit-webhooks.md)) → non retenus.
- **Stockage** : pas de copie des absences dans Airtable **[H]** — lecture à la demande. Voir phase 4 pour l'alternative.

**Plan de repli** : si la clé API ne peut pas être obtenue, l'interface User peut fonctionner avec le **flux .ics actuel** (parseur déjà écrit), au prix d'un rapprochement par nom et sans type ni statut d'absence.

---

## 4. Adéquation du modèle de données — écarts

*Seuls les écarts sont listés. Rien n'est créé sans accord. Chaque ajout de champ dans « Tps W » doit être fait à l'identique dans « Tps W TEST ».*

| # | Écart | Solution proposée |
|---|---|---|
| E1 | **Pas d'email ni de nom** pour relier compte Google ↔ collaborateur Airtable ↔ calendrier Payfit | Champs **`Email`** (email), **`Nom`** (texte, pour le rapprochement avec le calendrier Payfit « Prénom NOM ») et **`ID Payfit`** (texte, facultatif) dans **Collaborateur**, sur la fiche de l'exercice en cours (à recopier à la création des fiches de l'exercice suivant). Alternative : une table `Personnes` (1 ligne par personne) — plus propre, mais plus de travail ; non recommandée maintenant. |
| E2 | **Pas de statut mensuel** | Nouvelle table **`Validation mensuelle`** : `Clé` (formule `{Prénom} & " - " & {Mois}`), `Collaborateur` (lien fiche d'exercice), `Mois` (texte `YYYY-MM`), `Statut` (liste : A compléter / En attente de validation / Validée / Refusée), `Soumis le`, `Décision le`, `Décision par` (email), `Motif du refus` (texte long). Absence de ligne = « A compléter ». |
| E3 | **Trace de la confirmation « affaire clôturée »** | Dans Tps W et TEST : `Confirmation clôture` (case à cocher) + `Confirmée le` (date-heure). |
| E3b | (si retenu, contrôle 3) **confirmation week-end / férié** | `Confirmation jour non ouvré` (case) + `Confirmée le` commun. |
| E4 | **Traçabilité de la saisie** | Dans Tps W et TEST : `Source` (liste : Export Payfit / Application), `Saisi par` (email), `Modifié le` (dernière modification, automatique). Permet aussi de distinguer historique et nouvelles saisies dans les contrôles. |
| E5 | **Unicité créneau** non garantie | Garantie **par l'application** : avant chaque écriture, lecture des créneaux du collaborateur sur la période, puis mise à jour du record existant au lieu d'en créer un. Formule `Clé créneau` (`{ID Collab-Exercice}&"|"&DATETIME_FORMAT({Jour},'YYYY-MM-DD')&"|"&{Heure de début}`) pour la détection de doublons par l'Admin. |
| E6 | **Absences importées** : où les stocker ? | **Pas de stockage** **[H]** : lues à la demande dans Payfit (cache serveur). Les créneaux d'absence ne sont **pas écrits** dans Tps W → aucun coût affecté aux congés, comme aujourd'hui pour les congés absents de l'export. **Mais** l'existant écrit parfois `CONGE PE` comme une affaire — **Q8**. |
| E7 | **Commentaires** (« Voir les commentaires ») | Nouvelle table **`Commentaires`** : `Validation mensuelle` (lien), `Auteur` (email), `Texte`, `Créé le`. Un fil par collaborateur × mois. |
| E8 | **Préférences d'envoi des mails** | Champ `Recevoir les rappels` (case, cochée par défaut) dans Collaborateur. |
| E9 | **Paramètre de visibilité de la balance** pour les Users | Table **`Paramètres`** (1 ligne : `Balance visible par les Users`, case décochée). Modifiable par l'Admin depuis l'application. |
| E10 | **« Mes affaires »** : pas d'affectation | Sans création : affaires sur lesquelles le collaborateur a **déjà saisi du temps** (Tps W) **+** celles où son prénom figure dans `CDP` ou `Manager`. Avec création : champ lien `Équipe` (→ Collaborateur) dans Affaire — **Q9**. |
| E11 | **Balance financière et balance journalière** absentes | **Q6**. Proposition : champs formule dans Affaire `Balance PI` = `{Marché PI} − {Coût global}` et `Balance en jours` = `Balance PI / {coût journalier moyen}` — définition du coût journalier moyen à décider. L'application ne fait que lire. |
| E12 | **Codes hors affaire** non typés | Utiliser `Pôle = Autre` (suffisant). Corriger les rollups de Collaborateur et `CAT_NF` pour inclure G001 / P001 / R00x (**Q7**). |
| E13 | **« Nom du projet »** est une liste de ~230 options, recopie du libellé Payfit | L'application écrit `Nom affaire` de la table Affaire avec `typecast` (crée l'option au besoin). Les libellés changeront légèrement par rapport à Payfit ; aucun calcul ne les lit. |
| E14 | **ID du collaborateur** (Payfit) attendu dans chaque saisie | Renseigné depuis `Collaborateur.ID Payfit` (E1) ; vide tant que non renseigné, sans effet sur les calculs. |

---

## 5. Spécification

### 5.1 Architecture

**Recommandation : rester sans framework** pour cette évolution (page statique + fonctions Vercel), dans le prolongement de l'existant. Une migration Next.js n'apporterait rien d'indispensable et ferait courir un risque à la partie Admin. On pourra la reconsidérer si l'interface grossit.

```
/                 → redirection selon le rôle : Admin → /admin, User → /app
/admin            → index.html actuel (inchangé) + nouveaux onglets Validation et Balances
/app              → nouvelle page User (app.html) — mobile d'abord
/login            → inchangé
api/
  me.js           → + rôle
  v1.js           → routeur unique des endpoints métier (?action=…)
  airtable.js     → relais générique, désormais RÉSERVÉ AUX ADMINS
  calendar.js     → inchangé (repli .ics)
  _session.js, _roles.js, _airtable.js, _payfit.js, _feries.js, _regles.js  (modules partagés)
```

- **Un seul fichier de routage `api/v1.js`** : le plan Vercel Hobby limite le nombre de fonctions serveur par déploiement (12 **[?]** selon plan) ; l'existant en compte déjà 5.
- **Rôles, côté serveur** : `ADMIN_EMAILS` (variable). User = compte `@assemblage.net` présent dans Collaborateur (champ Email, E1). Le rôle est porté par le JWT **et** recalculé à chaque requête. L'accès cesse d'être une liste blanche manuelle `ALLOWED_EMAILS` : **Q10**.
- **Middleware** : `/admin` et `api/airtable` → 403 si non-Admin ; `/app` et `api/v1` → toute session valide ; chaque action de `v1` vérifie le rôle et, pour un User, **force le collaborateur = soi-même** (jamais lu dans la requête).
- **Aucun secret côté client** : `AIRTABLE_TOKEN`, `PAYFIT_ICS_URL`, `SESSION_SECRET` restent en variables Vercel.
- **Bascule de table** : `AIRTABLE_TABLE_TEMPS` (+ ids des champs dans un module unique) : `tbl7GeXNHASbjN9ka` en Preview, `tble4Su3mWGgez7mj` en Production. Les ids de champs diffèrent entre les deux tables → table de correspondance par environnement.
- **Filtrage des champs** : les endpoints User ne demandent à Airtable que des champs non sensibles (jamais `Cout`, `Coût`, montants). La balance n'est envoyée que si le paramètre E9 est actif.
- **Cache et lots** : référentiels Affaire/Collaborateur en cache mémoire 10 min ; écritures groupées par 10 ; enregistrement à la demande (bouton) et automatique 1,5 s après la dernière modification ; une file sérialise les écritures pour rester sous 5 req/s.
- **Jours fériés** : `feriesFR()` extrait dans `lib/feries.js`, chargé à la fois par la page (module ES) et par le serveur.
- **Payfit** : `api/_payfit.js` lit le flux `.ics` (`PAYFIT_ICS_URL`), le parse côté serveur et ne renvoie à un User que ses propres créneaux d'absence (§ 3.0).

### 5.2 Écrans User (`/app`)

En-tête : logo, mois courant, nom, menu. Navigation par **menus déroulants** (bureau : barre supérieure ; mobile : menu ☰).

```
┌ .A  Suivi des temps                     Malo B. ▾ ┐
│ [Mes affaires ▾]  [Mon suivi de temps ▾]          │
│   • en cours         • Saisie du mois             │
│   • terminées        • Historique des mois        │
└───────────────────────────────────────────────────┘
```

**Mes affaires — en cours / terminées**

```
Rechercher… [          ]                 12 affaires
A729S  PONTON SEILLE        STR  Etude     ▸ 6,5 j saisis ce mois · 21 j au total
A725S  VINCI_SN…            STR  Chantier  ▸ 1 j · 14 j
G001   GESTION              —    hors affaire
```
Colonnes : code, nom, pôle, état, temps saisi par moi (mois / total). Balance : colonne masquée tant que E9 est désactivé. Clic → filtre la saisie sur cette affaire (« Remplir avec cette affaire »).

**Mon suivi de temps — vue Liste** (reprend Payfit)

```
Suivi du temps de travail          Europe/Paris        Total 6,5 j  [Brouillon]
[Liste | Calendrier]   [Aujourd'hui] ‹ Novembre 2026 ›   💬 Commentaires (0)   [Soumettre le mois]
┌ S45 · 4,5 j ─────────────────────────────── [Copier S44] [Remplir la semaine…] ┐
│ Lun 2   ● Matinée     [A729S (PONTON…)  ▾]    Total 1 j                         │
│         ● Après-midi  [R003 (IA)        ▾]                                       │
│ Mar 3   ● Matinée     [G001 (GESTION)   ▾]                                       │
│         ● Après-midi  [A725S (VINCI_SN…)▾]                                       │
│ Mer 4   🏖 Absence (Payfit) — matin et après-midi           verrouillé     │
│ Sam 7   (grisé)                                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
Créneau maintenu : « ⚠ Affaire clôturée mais saisie maintenue par le collaborateur »
```

**Vue Calendrier** : grille mensuelle lun→dim, chaque jour coupé en deux bandes (matin / après-midi) colorées par affaire ; week-ends grisés ; fériés et absences hachurés avec libellé. Sélection de plusieurs créneaux (glisser ou Maj+clic) puis choix d'une affaire.

**Interactions et raccourcis** (cible : une semaine en moins de 60 s)

- **Copier la semaine précédente** (bouton par semaine) : recopie les 10 créneaux ouvrés, sans toucher aux créneaux verrouillés (absences, fériés).
- **Remplir plusieurs créneaux** : cases à cocher sur les créneaux (ou sélection au calendrier), puis une affaire → tous remplis.
- **Sélecteur d'affaire** avec recherche (code ou nom) : *Mes affaires en cours* d'abord, puis *Hors affaire* (G001, P001…), puis *Autres affaires en cours*, puis section repliée *Affaires clôturées*. Les 5 dernières affaires utilisées sont proposées en premier.
- Clavier : `↑/↓` entre créneaux, `Entrée` ouvre le sélecteur, saisie au clavier filtre, `Ctrl+D` recopie le créneau au-dessus, `←/→` change de mois.
- Couleur stable par affaire (dérivée du code).
- Totaux par jour, par semaine (S45 · 4,5 j) et par mois ; badge de statut du mois.

**Fenêtre « affaire clôturée »** (contrôle 1, décidé)

```
┌────────────────────────────────────────────────────────────┐
│ Cette affaire est terminée, confirmes-tu la saisie de temps ?│
│ A612S — XXXX · état « Terminé »                              │
│ [ Modifier la saisie ]                                       │
│ [ Je sais que cette affaire est terminée, je conserve tout   │
│   de même ma saisie ]                                        │
└────────────────────────────────────────────────────────────┘
```
« Modifier » : retour au sélecteur, rien n'est écrit. « Conserver » : écriture avec `Confirmation clôture = oui` et `Confirmée le`. En remplissage multiple, **une seule confirmation** pour l'ensemble des créneaux concernés.

**Soumission du mois** : le bouton lance le contrôle de complétude ; s'il manque des créneaux, liste cliquable (« Il manque : jeudi 12 après-midi, vendredi 13 ») et soumission bloquée. Sinon statut → « En attente de validation ». Mois **En attente** ou **Validée** : lecture seule (le salarié peut demander un déverrouillage par commentaire). Mois **Refusée** : bandeau avec le motif, saisie de nouveau ouverte.

**Commentaires** : panneau latéral, fil par mois, visible du salarié et des Admins.

### 5.3 Écrans Admin ajoutés (dans `/admin`)

**Validation mensuelle**

```
Validation — Octobre 2026          [‹ ›]    Filtre statut ▾  Pôle ▾
Collaborateur   Statut                 Complétude  Points   Clôturées maintenues
Pierre E.       En attente (02/11)     21/21 j     0        1   [Ouvrir]
Thibaud C.      A compléter            18/21 j     3        0   [Ouvrir] [Relancer]
Maël B.         Validée (03/11)        21/21 j     0        0   [Ouvrir]
                                           [Valider la sélection]
```
« Ouvrir » affiche le mois du collaborateur dans la **même vue Liste/Calendrier que le User**, en mode Admin : modification directe possible, puis **Valider** / **Refuser** (motif obligatoire, ajouté aux commentaires). Les créneaux maintenus sur affaire clôturée portent la mention.

**Balances** (inspiration Harvest — sans en reproduire l'interface)
- par affaire : Marché PI, coût consommé (Coût global), balance, balance en jours (champs E11), temps du mois par collaborateur ;
- par collaborateur : jours du mois par affaire, coût, taux facturable (repris du bilan existant).

**Paramètres** : interrupteur « Balance visible par les Users » (E9), liste des Admins (lecture, définie par variable).

**Contrôles** : l'onglet existant est conservé ; sa source devient **Tps W** (filtre mois) au lieu de l'Excel, une fois l'export arrêté. L'import Excel reste disponible jusqu'à la bascule.

### 5.4 Contrôles

#### Contrôle 1 — Affaire clôturée (décidé)

- **Préventif** : confirmation décrite ci-dessus.
- **Détectif** :
  - saisie **maintenue par le collaborateur** : **exclue du mail individuel**, **visible de l'Admin** (colonne « Clôturées maintenues » et mention sur le créneau) — c'est l'Admin qui juge de la facturabilité ;
  - **affaire clôturée APRÈS la saisie** (pas de confirmation) : signalée au salarié par le mail individuel et une alerte dans l'interface (« L'affaire A612S a été clôturée le … : vérifie tes saisies »), et à l'Admin. Détection quotidienne (cron).
- **États concernés** : Terminé et Interrompu (règle métier) **ou** les 4 états du code actuel (+ Annulé, Livré) — **Q1**.

#### Contrôles 2 à 5 — propositions à arbitrer

| Contrôle | Préventif possible | Détectif à conserver | Cas résiduels | Nouveau libellé |
|---|---|---|---|---|
| **2. Saisie incomplète** | Aucun blocage en cours de mois. **Blocage de la soumission** si incomplet. Compteur « reste X créneaux » dans l'en-tête. | Alerte dans l'interface ; mail individuel en fin de mois (ex. J-2 ouvrés et J+3) pour les mois non soumis ; vue Admin (complétude). | Absence **annulée** dans Payfit après soumission ; salarié qui ne se connecte jamais ; entrée/sortie en cours de mois (contrat). | « Il te reste N créneaux à compléter sur [mois] : [liste]. Complète-les dans l'application ou pose l'absence dans Payfit. » |
| **3. Week-end / férié** | Créneaux de week-end et fériés **masqués par défaut**, affichables (« Afficher le week-end »). **Suggestion évaluée : confirmation** du même type que l'affaire clôturée — pertinente : rare, légitime parfois, et la trace rend le mail inutile. | Si confirmée : exclue du mail, visible Admin (« saisie un jour non ouvré, confirmée »). Sinon (historique, saisie Admin) : mail. | Jour férié mal calculé (lundi de Pentecôte, Q3). | Confirmation : « Le [date] est un [samedi / jour férié]. Confirmes-tu ce temps ? » — mention : « Saisie un jour non ouvré, confirmée par le collaborateur ». |
| **4. Projet manquant** | **Impossible par construction** : un créneau est vide ou porte une affaire ; le sélecteur n'accepte que des affaires existantes. | Garder le contrôle sur Tps W pour les saisies d'autres sources (import, Airtable direct). Vue Admin uniquement. | Saisie faite dans Airtable directement ; affaire supprimée d'Airtable après saisie (lien vide). | (Admin) « Saisie sans affaire liée : à rattacher. » |
| **5. Travail pendant une absence** | Créneaux d'absence **validée** pré-remplis et **verrouillés** → impossible. Absence **en attente** : avertissement non bloquant. | Contrôle quotidien : absence **posée ou validée dans Payfit APRÈS la saisie** → alerte interface + mail individuel ; vue Admin. | Absence posée après **validation** du mois → l'Admin doit rouvrir le mois. Absence rétroactive après clôture de paie. | « Une absence a été enregistrée dans Payfit le [date] alors que tu avais saisi du temps sur ce créneau. Supprime la saisie dans l'application, ou corrige l'absence dans Payfit. » |

#### Contrôles propres au nouveau workflow

- **Complétude avant soumission** : tous les créneaux des jours ouvrés du mois (hors fériés et absences validées) portent une affaire. Bloquant.
- **Saisie impossible** sur un mois **En attente** ou **Validée** : vérifié **côté serveur** à chaque écriture (pas seulement grisé à l'écran). Un Admin peut écrire sur tout mois.

#### Contrôles complémentaires suggérés (à valider)

- **Doublon de créneau** : impossible par l'application (E5) ; contrôle Admin conservé pour les autres sources.
- **Saisie sur une affaire sans lien avec le collaborateur** (ni temps antérieur, ni CDP/Manager) : avertissement doux à la sélection, sans blocage — dépend de Q9.
- **Saisie sur une date future** : autorisée seulement pour J+1… fin de semaine (préparation) **[H]**, interdite au-delà du mois en cours.
- **Affaire au statut « AO » ou « Annulé »** : à traiter comme clôturée ? (lié à Q1).
- **Fiche collaborateur de l'exercice absente ou sans coût** : alerte Admin (sinon coût = 0, constaté en 24/25).

### 5.5 Mails individuels

- **Faisabilité** : aucun service actuel (§ 1.5). Recommandation **[H]** : **API Gmail avec un compte de service Workspace** (expéditeur `suivi-temps@assemblage.net`, pas de DNS à modifier) ou **Resend** (plus simple à brancher, DNS à ajouter) — **Q2**.
- **Contenu** : uniquement les points du destinataire ; chaque point a un **lien direct** vers le créneau (`/app?mois=2026-10#2026-10-12-PM`) ; plus aucune mention « corriger dans Payfit » sauf pour les absences.
- **Calendrier** [H] : rappel J-2 ouvrés avant fin de mois aux salariés dont le mois est incomplet ; mail J+3 aux mois non soumis ; mail immédiat en cas de **refus** (motif) ; récapitulatif **Admin** (mois non soumis, points ouverts, clôturées maintenues) à J+3.
- Désinscription possible des rappels (E8), jamais des refus.
- Envoi par un **cron Vercel** (`vercel.json` → `crons`) ; consultation de l'historique d'envoi dans l'Admin.

### 5.6 Plan de déploiement

1. **Branche dédiée** `feature/interface-user` ; preview Vercel avec variables *Preview* : `AIRTABLE_TABLE_TEMPS` = TEST, `ADMIN_EMAILS`, `PAYFIT_ICS_URL` (déjà en place).
2. **Google OAuth en preview** : les URL de preview changent à chaque déploiement ; ajouter l'**URL stable de branche** (`import-tps-w-git-feature-interface-user-<équipe>.vercel.app`) aux origines JavaScript autorisées du client OAuth, sinon la connexion échoue.
3. **Création des champs/tables** (E1-E9) dans Airtable, **d'abord sur TEST** — après accord.
4. **Tests de non-régression** : saisir un mois complet dans TEST via l'application ; vérifier que les contrôles Admin (A-E) et le bilan donnent les mêmes résultats que sur l'export Payfit du même mois ; vérifier `Coût` et les rollups d'Affaire sur les fiches liées.
5. **Pilote** : 2-3 salariés saisissent en double (Payfit + application TEST) pendant un mois.
6. **Bascule un 1ᵉʳ du mois** : variables Production → Tps W ; arrêt de la saisie Payfit et de l'export manuel à cette date ; le **dernier mois Payfit** est exporté, importé et validé selon l'ancien processus.
7. **Après bascule** : contrôles Admin lus depuis Tps W ; retrait progressif de l'import Excel.

### 5.7 Risques et points ouverts

- **RGPD** : l'outil enregistre des temps nominatifs, des absences (dont maladie, par le type Payfit) et une traçabilité des connexions. **Ne lire et n'afficher que le fait « absent »** (pas le type) aux autres personnes ; afficher le type uniquement au salarié concerné **[H]**. Mettre à jour le registre des traitements ; durée de conservation à fixer.
- **CSE** : un outil qui permet de **contrôler l'activité individuelle** (relances, validation, traçabilité) relève de l'**information-consultation du CSE** (art. L2312-38 C. trav.) et de l'information préalable des salariés (art. L1222-4) — **à faire vérifier par un juriste** avant mise en production.
- **Débit Airtable** (5 req/s) en fin de mois quand tout le monde saisit : à surveiller (cache + file).
- **Fiches d'exercice** : au 1ᵉʳ juillet, les fiches « Prénom - 27/28 » (avec Email et Cout) doivent exister **avant** la première saisie, sinon lien impossible.
- **Lien collaborateur par prénom** : deux salariés de même prénom casseraient la clé « Prénom - exercice » de l'existant — l'application liera par **record id via l'email**, ce qui supprime ce risque pour les nouvelles saisies.
- **Volume** : ~6 600 enregistrements/an (§ 2.8), limite du plan à vérifier.

---

## Questions ouvertes

| # | Question |
|---|---|
| Q1 | États « clôturés » : **Terminé + Interrompu** (règle métier) ou aussi **Annulé** et **Livré** (code actuel) ? |
| Q2 | Service d'envoi des mails individuels : API Gmail (compte de service Workspace), Resend, ou `mailto:` manuel ? Qui administre la console Google Workspace ? |
| Q3 | Le **lundi de Pentecôte** est-il travaillé chez Assemblage (journée de solidarité) ? |
| Q4 | ~~Clé API Payfit~~ — **tranché** : flux .ics conservé (§ 3.0). Reste à confirmer : le flux contient-il les absences **en attente de validation** ? |
| Q5 | Quel est le **plan Airtable** (limite d'enregistrements par base) ? |
| Q6 | **Balance financière** et **balance journalière** n'existent pas dans Affaire : quelle définition ? (`Marché PI − Coût global` ? en jours : divisé par quel coût journalier ?) Faut-il les créer en formules Airtable ? |
| Q7 | Corriger maintenant le classement **G001 / P001 / R00x** (nouveaux codes) dans les rollups Collaborateur et dans le bilan de l'application ? |
| Q8 | **CONGE PE** : continue-t-on à l'écrire dans Tps W pour les congés (comme certains imports), ou les absences Payfit suffisent-elles (rien d'écrit) ? |
| Q9 | « Mes affaires » : se contenter des affaires déjà travaillées + CDP/Manager, ou créer un lien **Équipe** dans Affaire ? |
| Q10 | Accès : garder la liste blanche `ALLOWED_EMAILS`, ou ouvrir à tout compte `@assemblage.net` présent dans Collaborateur ? |
| Q11 | Validation de la **création des champs et tables E1 à E9** dans Airtable (TEST puis production) ? |
| Q12 | Saisie sur **date future** : autorisée jusqu'à la fin de la semaine en cours, ou interdite ? |
| Q13 | Accord sur l'architecture **sans framework** (vs migration Next.js) ? |

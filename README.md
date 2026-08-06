# Import Tps W — Assemblage ingénierie

Import des temps de travail Payfit vers Airtable, avec contrôles de saisie
avant import, rapport diffusable aux salariés et bilan mensuel de facturabilité.

## Ce que fait l'outil

**1 — Contrôles de saisie.** Cinq règles repèrent ce qui demande une correction :

| | Règle | Détecte |
|---|---|---|
| A | Projet manquant | temps déclaré sans code projet |
| B | Weekend / jour férié | temps sur un jour non ouvré (possible, mais à confirmer) |
| C | Saisie incomplète | jours ouvrés non couverts, hors congés Payfit |
| D | Travail pendant une absence | temps déclaré sur un créneau en congé |
| E | Affaire clôturée | temps sur une affaire terminée, annulée ou interrompue |

Le rapport est groupé par salarié et exportable en e-mail HTML, PDF ou Excel,
pour être transmis tel quel à l'équipe.

**2 — Bilan mensuel** *(document interne)*. Répartition du temps déclaré entre
facturable et les quatre catégories non facturables — Prospection, R&D-Formation,
Intelligence artificielle, Gestion — sous forme de barre 100 % par salarié, avec
répartition par pôle, résumé des affaires et valorisation au coût de revient.
Filtrable par salarié et par pôle.

**3 — Import Airtable.** Résolution automatique des liens Collaborateur et
Affaire, envoi par lots de 10.

## Deux modes d'exécution

**Déployé** — le calendrier des congés se charge automatiquement, l'accès est
protégé par connexion Google.

**Local** — ouvrir `index.html` dans un navigateur. Tout fonctionne sauf la
récupération automatique du calendrier et le token Airtable partagé : il faut
déposer le `.ics` à la main et coller son propre Personal Access Token dans
Paramètres.

> L'API Payfit ne renvoie aucun en-tête `Access-Control-Allow-Origin`. Aucune page
> web ne peut donc l'appeler directement, quel que soit son hébergement. C'est la
> raison d'être du relais `/api/calendar`, qui fait l'appel serveur à serveur.

## Déploiement

Hébergement sur Vercel. Six variables d'environnement à déclarer
(voir [`.env.example`](.env.example)) :

| Variable | Rôle |
|---|---|
| `PAYFIT_ICS_URL` | flux d'absences Payfit — **secret porteur** |
| `GOOGLE_CLIENT_ID` | identifiant OAuth Google (non secret) |
| `ALLOWED_EMAILS` | adresses autorisées, séparées par des virgules |
| `ALLOWED_HD` | domaine Workspace exigé, ex. `assemblage.net` |
| `SESSION_SECRET` | signature du cookie de session |
| `AIRTABLE_TOKEN` | PAT Airtable partagé — **secret**, lecture/écriture de toute la base |

`AIRTABLE_TOKEN` passe par le relais `/api/airtable`, protégé par la même
session que le reste de l'app : un seul token pour tous les utilisateurs
autorisés, au lieu d'un PAT personnel à générer par personne. En local, chacun
continue de coller le sien dans Paramètres, comme avant.

Côté Google Cloud : créer un ID client OAuth de type **Application Web** et
déclarer l'origine du déploiement dans les origines JavaScript autorisées.

## Modèle d'accès — ce qui est protégé, ce qui ne l'est pas

L'application entière est réservée aux adresses de `ALLOWED_EMAILS`. Sans session
valide, le middleware redirige les pages vers `/login` et répond `401` aux appels
de données. Une adresse retirée de la liste perd l'accès à la requête suivante,
sans attendre l'expiration du cookie.

- **Protégé** : le calendrier Payfit, dont l'URL ne quitte jamais le serveur, et
  l'accès à l'application, bilan et coûts nominatifs compris.
- **Non protégé par l'OAuth** : les données Airtable. Elles restent gouvernées par
  le jeton personnel de chaque utilisateur, stocké dans son propre navigateur.
  L'application n'a aucun accès à Airtable qui lui soit propre.

Le bilan porte des montants nominatifs. Les exports destinés aux salariés — e-mail,
PDF et Excel du rapport de contrôles — n'en reprennent aucun : ni euro, ni coût,
ni taux de facturabilité. Les deux circuits d'export sont volontairement séparés.

## Conventions métier

- **Exercice fiscal** : 1ᵉʳ juillet → 30 juin. Juillet 2026 relève de `26/27`.
- **Unité** : la demi-journée. Une saisie de 0,75 j est signalée comme suspecte.
- **Clé collaborateur** : `Prénom - exercice`, ex. `Margot - 26/27`.
- **Pôle** : lu depuis Airtable, avec repli sur le suffixe du code projet
  (`A717S` → STR, `A629E` → ENV, `A031D_2` → DEV).
- **`CONGE PE`** : exclu du bilan, ce n'est pas du temps de travail, mais compté
  comme journée couverte par la règle C — un jour déclaré en congé n'est pas un
  jour manquant.

> À noter : le champ `% Non productif` de la table Collaborateur calcule
> `(RDF + Gestion + Prospection) / jours travaillés` et **omet l'activité IA**.
> Le bilan de cet outil l'inclut, d'où un écart attendu avec Airtable — 2,8 points
> sur juillet 2026.

## Dépendances

Côté navigateur, chargées par CDN : [SheetJS](https://sheetjs.com/) pour la
lecture Excel, Open Sans, et Google Identity Services sur la page de connexion.
Côté serveur : [`jose`](https://github.com/panva/jose) pour la vérification des
jetons. Aucune étape de build.

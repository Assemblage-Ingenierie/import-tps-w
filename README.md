# Suivi des temps — Assemblage ingénierie

Application Next.js (App Router, TypeScript) hébergée sur Vercel
(timesheetai.assemblage.net). Elle remplace le module « Suivi du temps de
travail » de Payfit :

- **User** (tout compte Google `@assemblage.net`) : saisie des temps par
  demi-journée, vues Liste et Calendrier, soumission du mois, commentaires,
  « Mes affaires » (affaires dont on est Chef·fe de projet ou Manager).
- **Admin** (`ADMIN_EMAILS`) : validation mensuelle, relecture et correction du
  mois d'un collaborateur, balances, paramètres, et l'**outil historique**
  (import de l'export Payfit, contrôles, bilan) conservé tel quel sous
  `/admin/import` (`public/legacy/import.html`).

Les temps sont écrits dans Airtable (« Temps W », ou « Temps W TEST » hors
production) en respectant le contrat de données de l'export Payfit. Les
absences sont lues dans le calendrier Payfit, en lecture seule.

Conception détaillée : [`docs/conception-interface-user.md`](docs/conception-interface-user.md).

## Commandes

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

## Variables d'environnement

Voir [`.env.example`](.env.example).

| Variable | Rôle |
|---|---|
| `GOOGLE_CLIENT_ID` | identifiant OAuth Google (non secret) |
| `ALLOWED_HD` | domaine Workspace exigé (défaut `assemblage.net`) |
| `ADMIN_EMAILS` | administrateurs, séparés par des virgules (repli : `ALLOWED_EMAILS`) |
| `SESSION_SECRET` | signature du cookie de session — **secret** |
| `AIRTABLE_TOKEN` | PAT Airtable — **secret** |
| `PAYFIT_ICS_URL` | calendrier d'absences Payfit — **secret porteur** |
| `TPSW_ENV` | `production` pour écrire dans « Temps W » ; sinon « Temps W TEST » |

## Architecture

```
proxy.ts              garde d'accès (session, rôle Admin) — Next 16 « proxy »
lib/config.ts         IDs Airtable (tables, champs), bascule test / production
lib/session.ts        session JWT, rôles
lib/airtable.ts       client Airtable (file 5 req/s, lots de 10, cache)
lib/payfit.ts         lecture et analyse du calendrier d'absences
lib/referentiels.ts   affaires et fiches collaborateur (cache 10 min)
lib/temps.ts          lecture / écriture des créneaux dans Temps W
lib/mois.ts           mois de saisie, statut, commentaires, règles
lib/dates.ts          dates, jours fériés (lundi de Pentecôte travaillé)
app/api/*             routes serveur (rôle vérifié dans chaque handler)
app/(app)/*           pages authentifiées
components/*          écran de saisie, sélecteur d'affaire, en-tête
public/legacy/        outil Admin historique (import Payfit, contrôles, bilan)
```

## Règles de sécurité

- Aucun secret côté navigateur : Airtable et Payfit ne sont appelés que par le serveur.
- Un User n'agit que sur ses propres temps ; le paramètre `prenom` est réservé aux Admins.
- Coûts et balances ne sont jamais envoyés à un User, sauf balance si l'Admin
  l'active dans Paramètres.
- Le relais Airtable générique et le calendrier Payfit brut de l'outil
  historique sont réservés aux Admins.

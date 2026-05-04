# Import Tps W — Assemblage ingénierie

Outil d'import des temps de travail depuis un fichier Excel vers Airtable.

## Utilisation

Ouvrir `import_tps_w V1.html` directement dans un navigateur — aucune installation requise.

### Étapes

1. **Paramètres** — saisir le Personal Access Token Airtable (`patXXX…`) une seule fois (stocké en localStorage)
2. **Fichier Excel** — glisser-déposer le fichier `.xlsx` d'export temps W
3. **Validation** — vérifier les alertes et la résolution des liens collaborateurs / affaires
4. **Import** — lancer l'envoi vers Airtable

## Prérequis

- Un Personal Access Token Airtable avec accès en lecture/écriture sur la base cible
- Le fichier Excel exporté depuis W (colonnes attendues documentées dans le code)

## Dépendances

Chargées via CDN, aucune installation npm :

- [SheetJS / xlsx 0.18.5](https://sheetjs.com/) — lecture des fichiers Excel
- [Open Sans](https://fonts.google.com/specimen/Open+Sans) — police Assemblage

// Configuration Airtable : identifiants de base, de tables et de champs.
//
// Les écritures se font par ID de champ (un renommage dans Airtable ne casse
// rien). Les filtres `filterByFormula`, eux, ne savent référencer que des NOMS
// de champs : ils sont regroupés dans NOMS pour qu'un renommage se corrige ici.
//
// Bascule test / production : variable TPSW_ENV. Par défaut « test » — un
// déploiement mal configuré écrit dans le bac à sable, jamais en production.

export type Env = 'test' | 'production';

export function envCourant(): Env {
  return process.env.TPSW_ENV === 'production' ? 'production' : 'test';
}
export const LIBELLE_ENV: Record<Env, string> = { test: 'Test', production: 'Production' };

export const BASE_ID = 'app7d0qSY8L7om0Ke';

// ── Temps W / Temps W TEST ────────────────────────────────────────────────
// Les deux tables ont la même structure mais des IDs de champs différents.
// Les champs ajoutés pour l'application (confirmation, source…) n'existent
// pour l'instant que dans TEST : null = champ absent, ni lu ni écrit.
export interface ChampsTemps {
  idCollab: string;
  nom: string;
  prenom: string;
  jour: string;
  code: string;
  nomProjet: string;
  temps: string;
  unite: string;
  creneau: string;
  linkCollab: string;
  linkAffaire: string;
  confClot: string | null;
  confNonOuvre: string | null;
  confLe: string | null;
  source: string | null;
  saisiPar: string | null;
}

export const TEMPS: Record<Env, { table: string; f: ChampsTemps }> = {
  test: {
    table: 'tbl7GeXNHASbjN9ka',
    f: {
      idCollab: 'fldaNQFIih1icdnni',
      nom: 'fldJWi3UknNMSg9HC',
      prenom: 'fldEi9c90zqXuG6pO',
      jour: 'fldCtKxVTMWLHUSgm',
      code: 'fldf07sN27uqSe3Aj',
      nomProjet: 'fldXwL1e1NUGznlyC',
      temps: 'fldbXmxWiCT6MyRId',
      unite: 'fldsXEd9mXGFG35DS',
      creneau: 'fldn8Bqhb5ozYD18s',
      linkCollab: 'fldqNS6DeDHSmpRrm',
      linkAffaire: 'fldeH3P2wI8u1Yj8R',
      confClot: 'fld06GNUo82YtxMhP',
      confNonOuvre: 'fld9Xqvz5LMTN5HiR',
      confLe: 'fldqtHzYy4xbIRXmB',
      source: 'fldFHQcDZX1UT0OiJ',
      saisiPar: 'fldpJvaIDONiPIoRw',
    },
  },
  production: {
    table: 'tble4Su3mWGgez7mj',
    f: {
      idCollab: 'fldhbucYXDPn7Zlpr',
      nom: 'fldQkWAaZJBRN27JL',
      prenom: 'fldLGNJpFVe2ps4rX',
      jour: 'fldJRo4by8KQCGQiv',
      code: 'fldmoLZ3HtivN01Cs',
      nomProjet: 'fld4UpyuG9ILu9jAL',
      temps: 'fldil04cXYHbHkPKm',
      unite: 'fldzliKp1juKBP3F1',
      creneau: 'flduwfXxQrcETpZaB',
      linkCollab: 'fldxbwDTTZvXhbPtv',
      linkAffaire: 'fldl5Hmib4WzWKha0',
      // À créer dans Tps W avant la bascule (cf. docs/conception-interface-user.md)
      confClot: null,
      confNonOuvre: null,
      confLe: null,
      source: null,
      saisiPar: null,
    },
  },
};

export const CRENEAU_LIBELLE = { AM: 'Matinée', PM: 'Après-midi' } as const;

// ── Collaborateur ─────────────────────────────────────────────────────────
export const COLLAB = {
  table: 'tblfv2fUdCrKOVjMO',
  f: {
    cle: 'fld9WrKGu5VYU3sOy', // « Prénom - exercice »
    prenom: 'fldcAbK39iODSUAwP',
    exercice: 'flduvJoY8uI8lVmcs',
    cout: 'fld5WfohdX3XFHRD2', // coût journalier — ADMIN UNIQUEMENT
    email: 'fldSetis69MISYRAt',
    nom: 'fld2VZtRM5lZ8cL4h',
    idPayfit: 'fldrSXfg6Uyf6mOJv',
  },
};

// ── Affaire ───────────────────────────────────────────────────────────────
export const AFFAIRE = {
  table: 'tblOT9d8lAnOS50wK',
  f: {
    libelle: 'fldjks1eYKuwqPtcs',
    clef: 'fld3POCst63t3kpBv',
    nom: 'fldtSnDRkwS4dkcsa',
    etat: 'fldlMVWpA50MXa66M',
    pole: 'fldJyT3Lu0ZEH7EYE',
    manager: 'fldUQFydI5XQeEVKy',
    cdp: 'fldOMWQQ5tFauyWm5',
    marchePI: 'fldsHe8THeJc870ab',
    // Coût consommé retenu pour la balance (décision du 12/11/2026) : « Coût 26/27 ».
    // À faire évoluer à chaque exercice, ou à remplacer par « Coût global » (fldwnZEJghmgLZodq).
    coutConsomme: 'fld3ea25bq1vnQBRf',
  },
};
export const LIBELLE_COUT_CONSOMME = 'Coût 26/27';

// États d'affaire « clôturée » : saisie possible après confirmation.
export const ETATS_CLOS = new Set(['Terminé', 'Annulé', 'Interrompu', 'Livré']);

// ── Tables propres à l'application ────────────────────────────────────────
export const VALIDATION = {
  table: 'tblLIZZd8IUJMMEll',
  f: {
    cle: 'fldbqDFDdJdt5MoHc',
    email: 'fldXQ4SlYEazHOI29',
    mois: 'fldlqwpVdvYADdriF',
    env: 'fldXwB6vI2JubKc3o',
    statut: 'fld81kVJURQRcjO6G',
    collab: 'fldubjlbpulBu7UEw',
    soumisLe: 'fldaLIxoGPmcYUznL',
    decisionLe: 'fld8SGWe8zn5u7hFd',
    decisionPar: 'fldOkVI1HOMLSOo6a',
    motif: 'fldL59Nj8eubyVw7P',
  },
};

export const COMMENTAIRES = {
  table: 'tblZKAa8jf9TFtR6C',
  f: {
    texte: 'fldLJXIbkdZIl4axf',
    emailCollab: 'fldznMWo3K1PsFdJR',
    mois: 'fldUQXgybh7aY3pjr',
    env: 'fldARGhlRoVptPPru',
    auteur: 'fldlqqFFwgkzZKNiZ',
    auteurNom: 'fldN4BIxjthX3uPlc',
    creeLe: 'fldnb4VfPB3p4ZK6r',
    cleMois: 'fldhRQeWRVZdXV9GC',
  },
};

export const PARAMETRES = {
  table: 'tbltsJGwGWZL9rhgv',
  f: { cle: 'fldFdqpNocQrh5XZ0', actif: 'fldEjk39VlJxM4l3Q' },
};
export const PARAM_BALANCE_USERS = 'balance_visible_users';

// Noms de champs utilisés dans filterByFormula (Airtable n'accepte pas les IDs).
export const NOMS = {
  tempsCleCollab: 'ID Collab-Exercice',
  tempsJour: 'Jour',
  tempsExercice: 'Exercice',
  validationCle: 'Clé',
  validationMois: 'Mois',
  validationEnv: 'Environnement',
  commentairesCleMois: 'Clé mois',
  parametresCle: 'Clé',
};

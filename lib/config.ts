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
  confAbsence: string | null;
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
      confAbsence: 'fldXqIPxGLApPd2Wk',
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
      // Créés dans Tps W le 17/11/2026 pour la bascule de l'application.
      confClot: 'fldDZXRLtlMmaMzCZ',
      confNonOuvre: 'fldCeDJdkytp3Iew9',
      confAbsence: 'fldkEi92oSyeJ6uYY',
      confLe: 'fldhcEHWqrmd5UJPi',
      source: 'fldPPBJD6ZrHgIISg',
      saisiPar: 'fldN2HyyW86DcmAoQ',
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
    // Rentabilités calculées dans Airtable (formules, en €). L'application les
    // affiche telles quelles, sans les recalculer.
    rentaGlobale: 'fldzzOVKS1UYkX2g4',  // « Rentabilité Globale »
    rentaExercice: 'fldZqnjx4pyjv8LwC', // « Rentabilité 25/26 »
    facture: 'fldvfNvs6Kv9nLUHw',       // « % Facturé » (formule, 0 à 1)
    // Champs saisis à la création d'une affaire (fenêtre « Créer une affaire »).
    codeMoa: 'fldn9itX7U4qVB9R5',       // « Code MOA/Pays »
    codeAdresse: 'fld2LpajCphMKuO7Y',   // « Code Adresse/Projet »
    contrat: 'fld3RTghxnE3TpiNZ',
    architecte: 'flddXe8aXjrm93TRv',    // liens vers Sync CRM
    moa: 'fld4hir1bk32yohwy',           // « Maître d'ouvrage »
    bet: 'fldtlL72TQIAXBu1q',           // « BET associés »
    entreprise: 'fldWsiJtKrOWyzRDr',
    adresse: 'fldp5UtSsWF65ZgZ9',
    progPrincipaux: 'fldKNKtsZNpvmf695',
    progSecondaires: 'fldaTqKMNrIpeGBma',
    materiaux: 'fldC4SW9n1H2PZ3MH',
    rehabNeuf: 'fldyD7L9E7cGL26vH',
    surface: 'fld9HmFcoH2XYpm6y',       // « Surface(m²) »
    budgetHT: 'fldc9yGvzPAdhG6JR',
  },
};

// ── Sync CRM ─────────────────────────────────────────────────────────────
// Table synchronisée depuis la base « CRM » : organisations (architectes,
// maîtres d'ouvrage, BET, entreprises) liées aux affaires.
export const CRM = {
  table: 'tbldFyeiID6wEA0ET',
  f: { nom: 'fldAgF3mTYqbAE103', role: 'fldus5VL4hBxcvmvd', competences: 'fld6nyiBd9joiW4uM' },
};

// Mois antérieurs à l'ouverture de Carnet : déjà recensés dans Tps W (import
// Payfit), considérés comme validés et non modifiables par les Users.
export const MOIS_OUVERTURE = '2026-11';
export const LIBELLE_RENTA_GLOBALE = 'Rentabilité globale';
export const LIBELLE_RENTA_EXERCICE = 'Rentabilité 25/26';

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
    // Table unique (13/11/2026) : commentaires et paramètres y sont aussi rangés.
    type: 'fldaF4xoArvUQsKyR',         // « Mois » ou « Paramètre » (vide = Mois)
    commentaires: 'fldeLHo2ecU8nlgYX', // fil JSON des commentaires du mois
    actif: 'fldLFrSAardlVWKZO',        // lignes Paramètre
    description: 'fldHERif4417af1R4',  // lignes Paramètre
    nonTravailles: 'fldaI5E737eLo5UgJ', // lignes Mois : demi-journées ouvrées désactivées (JSON)
  },
};

// Clé de la ligne « Paramètre » dans la table AI Timesheet.
export const PARAM_BALANCE_USERS = 'PARAMETRE|balance_visible_users';
export const PARAM_FACTURATION_USERS = 'PARAMETRE|facturation_visible_users';

// Noms de champs utilisés dans filterByFormula (Airtable n'accepte pas les IDs).
export const NOMS = {
  tempsCleCollab: 'ID Collab-Exercice',
  tempsJour: 'Jour',
  tempsExercice: 'Exercice',
  validationCle: 'Clé',
  validationMois: 'Mois',
  validationEnv: 'Environnement',
  validationCommentaires: 'Commentaires',
  affaireClef: 'Clef',
};

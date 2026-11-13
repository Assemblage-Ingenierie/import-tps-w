// Types échangés entre le serveur et le navigateur. Rien de sensible ici :
// les coûts et balances ne transitent que dans les types *Admin, et la balance
// User seulement quand le paramètre Admin l'autorise.

export type Creneau = 'AM' | 'PM';
export type Statut = 'A compléter' | 'En attente de validation' | 'Validée' | 'Refusée';

export interface AffaireLite {
  id: string;
  code: string;
  nom: string;
  etat: string;
  pole: string;
  clos: boolean;
  horsAffaire: boolean; // Pôle « Autre » : codes G / P / R…
}

export interface Creneau_ {
  date: string;
  creneau: Creneau;
  affaireId: string | null;
  confirmClot: boolean;
  confirmNonOuvre: boolean;
  confirmAbsence: boolean;
}

export interface Jour {
  date: string;
  ferie: string | null;
  weekend: boolean;
  absence: { AM: boolean; PM: boolean };
}

export interface Manquant { date: string; creneau: Creneau }
export interface Conflit { date: string; creneau: Creneau; affaireId: string }

export interface DonneesMois {
  ym: string;
  env: 'test' | 'production';
  collab: { cle: string; prenom: string; nom: string; ficheId: string | null };
  statut: Statut;
  motifRefus: string | null;
  soumisLe: string | null;
  decisionLe: string | null;
  jours: Jour[];
  creneaux: Creneau_[];
  affaires: Record<string, AffaireLite>; // affaires référencées dans le mois
  editable: boolean;
  raisonVerrou: string | null;
  absencesDisponibles: boolean;
  completude: { attendus: number; couverts: number; manquants: Manquant[] };
  conflits: Conflit[]; // temps saisi sur un créneau d'absence Payfit
  vueAdmin: boolean;
  modifieApresEnvoi: boolean;
  nonTravailles: string[]; // « AAAA-MM-JJ|AM » désactivées par le collaborateur
}

export interface Changement {
  date: string;
  creneau: Creneau;
  affaireId?: string | null; // absent = ne touche pas au temps saisi
  nonTravaille?: boolean;    // true : demi-journée désactivée ; false : réactivée
  confirmClot?: boolean;
  confirmNonOuvre?: boolean;
  confirmAbsence?: boolean;
}

export interface Commentaire {
  id: string;
  texte: string;
  auteur: string;
  auteurNom: string;
  creeLe: string;
  mois: string;        // « 2026-11 »
  modifiable: boolean; // vrai seulement pour l'auteur
}

export interface AffaireMienne extends AffaireLite {
  role: string;          // « Chef·fe de projet », « Manager »
  joursExercice: number; // mes jours saisis sur l'exercice en cours
  balance?: number | null;       // seulement si autorisé
}

export interface LigneValidation {
  cle: string;
  prenom: string;
  nom: string;
  ficheId: string;
  email: string | null;
  statut: Statut;
  soumisLe: string | null;
  attendus: number;
  couverts: number;
  conflits: number;
  clotureesMaintenues: number;
  nonOuvresConfirmes: number;
  commentaires: number;
  dernierCommentaire: { auteurNom: string; texte: string; creeLe: string } | null;
}

export interface LigneBalance {
  id: string;
  code: string;
  nom: string;
  etat: string;
  pole: string;
  marchePI: number | null;
  rentaGlobale: number | null;
  rentaExercice: number | null;
  parCollab: { prenom: string; jours: number; cout: number | null }[];
}

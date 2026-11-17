// Options des listes de la table Affaire, telles que définies dans Airtable
// (relevées le 17/11/2026). Partagées par la fenêtre « Créer une affaire »
// et par la vérification côté serveur. Une option ajoutée dans Airtable
// doit l'être ici aussi pour apparaître dans Carnet.

export const POLES = ['STR', 'ENV', 'DEV', 'AI BOIS', 'Autre'];
export const ETATS_INTERNES = ['AO', 'Etude', 'Chantier', 'En Cours', 'Livré', 'Terminé', 'Annulé', 'Interrompu'];
export const CONTRATS = ['Signé', 'En négo', 'Pas de contrat', 'Inconnu'];
export const MANAGERS = ['Pierre', 'Clément', 'Aliénor', 'Stanislav', 'Thibaud', 'Guillaume', 'Rémi', 'Maël'];
export const CDPS = ['Aliénor', 'Amaury', 'Bahiya', 'Chaïma', 'Clément', 'Gabriel', 'Guillaume', 'Lou', 'Louis', 'Maël', 'Malo', 'Margot', 'Pierre', 'Rémi', 'Stanislav', 'Thibaud', 'Thomas'];
export const MATERIAUX = ['acier', 'béton', 'bois', 'bois-paille', 'maçonnerie', 'paille', 'pierre', 'pierre de taille', 'verre', 'aluminium', 'BTCs'];
export const REHAB_NEUF = ['Neuf', 'Réhabilitation'];
export const PROG_PRINCIPAUX = ['Art', 'Commerce & activités', 'Culture', 'Éducation', 'Flottant', 'Industrie & logistique', 'Logement', 'Mobilité', 'Ouvrage d’art', 'Patrimoine', 'Santé & social', 'Sport & loisirs', 'Tertiaire'];
export const PROG_SECONDAIRES = ['Scolaire', 'Restauration scolaire', 'Centre de loisir', 'Enseignement supérieur', 'Formation professionnelle', 'Laboratoire', 'Musée', 'Théâtre', 'Bibliothèque', 'Monument historique', 'Lieu de culte', 'Gymnase', 'Stade', 'Piscine', 'Parc', 'Espace public', 'Hôpital', 'Médico-social', 'Hébergement d’urgence', 'Logement collectif', 'Logement individuel', 'Résidence étudiante', 'Résidence Seniors', 'Bureaux', 'Administration publique', 'Centre communautaire', 'Commerce', 'Restauration', 'Hôtel', 'Marché', 'Atelier', 'Usine', 'Entrepôt', 'Gare', 'Aéroport', 'Parking', 'Port', 'Pont', 'Passerelle', 'Fluvial', 'Maritime', 'Oeuvre d’art', 'Scénographie', 'Salle de spectacle'];

// Nouvelle affaire telle qu'envoyée par la fenêtre « Créer une affaire ».
export interface NouvelleAffaire {
  clef: string;
  codeMoa: string;
  codeAdresse: string;
  pole: string;
  etat: string;
  contrat: string;
  architecte: string[];   // IDs d'organisations (Sync CRM)
  moa: string[];
  bet: string[];
  entreprise: string[];
  adresse: string;
  progPrincipaux: string[];
  progSecondaires: string[];
  materiaux: string[];
  rehabNeuf: string[];
  surface: number | null;
  budgetHT: number | null;
  manager: string;
  cdp: string[];
  marchePI: number | null;
}

export interface Organisation { id: string; nom: string; roles: string[] }

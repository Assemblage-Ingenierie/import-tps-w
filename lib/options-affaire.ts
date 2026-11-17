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

export interface Organisation { id: string; nom: string; roles: string[]; competences: string[] }

// ── Couleurs des options (celles d'Airtable, relevées le 17/11/2026) ─────────
export const COULEURS: Record<string, Record<string, string>> = {
  "POLES": {
    "STR": "orangeLight1",
    "ENV": "greenLight1",
    "DEV": "blueLight1",
    "Autre": "yellowLight2",
    "AI BOIS": "blueDark1"
  },
  "ETATS_INTERNES": {
    "Terminé": "cyanLight2",
    "Etude": "blueLight2",
    "AO": "redLight2",
    "Chantier": "tealLight2",
    "Livré": "orangeLight2",
    "Annulé": "greenLight2",
    "Interrompu": "yellowLight2",
    "En Cours": "purpleLight2"
  },
  "CONTRATS": {
    "Signé": "blueLight2",
    "Pas de contrat": "cyanLight2",
    "Inconnu": "tealLight2",
    "En négo": "greenLight2"
  },
  "MANAGERS": {
    "Pierre": "blueLight2",
    "Clément": "cyanLight2",
    "Aliénor": "grayLight1",
    "Stanislav": "cyanBright",
    "Thibaud": "pinkBright",
    "Guillaume": "tealLight2",
    "Rémi": "greenLight2",
    "Maël": "yellowLight1"
  },
  "CDPS": {
    "Thomas": "blueLight2",
    "Malo": "cyanLight2",
    "Amaury": "tealLight2",
    "Thibaud": "greenLight2",
    "Gabriel": "yellowLight2",
    "Margot": "orangeLight2",
    "Guillaume": "redLight2",
    "Clément": "cyanLight2",
    "Bahiya": "purpleLight2",
    "Pierre": "grayLight2",
    "Stanislav": "blueLight1",
    "Maël": "yellowLight1",
    "Rémi": "tealLight1",
    "Lou": "redLight1",
    "Chaïma": "cyanDark1",
    "Aliénor": "grayLight1",
    "Louis": "tealBright"
  },
  "MATERIAUX": {
    "acier": "grayLight2",
    "béton": "greenLight2",
    "bois": "tealLight2",
    "maçonnerie": "orangeLight2",
    "paille": "yellowLight2",
    "pierre": "pinkLight2",
    "verre": "blueLight1",
    "pierre de taille": "blueLight2",
    "bois-paille": "cyanLight2",
    "aluminium": "tealDark1",
    "BTCs": "cyanLight1"
  },
  "REHAB_NEUF": {
    "Neuf": "cyanLight2",
    "Réhabilitation": "tealLight2"
  },
  "PROG_PRINCIPAUX": {
    "Art": "orangeDark1",
    "Commerce & activités": "orangeLight1",
    "Culture": "tealLight2",
    "Éducation": "blueLight2",
    "Flottant": "tealDark1",
    "Industrie & logistique": "pinkLight1",
    "Logement": "purpleLight2",
    "Mobilité": "grayLight1",
    "Ouvrage d’art": "blueBright",
    "Patrimoine": "yellowDark1",
    "Santé & social": "redLight2",
    "Sport & loisirs": "yellowLight2",
    "Tertiaire": "greenLight1"
  },
  "PROG_SECONDAIRES": {
    "Scolaire": "blueLight2",
    "Restauration scolaire": "blueLight2",
    "Centre de loisir": "blueLight2",
    "Enseignement supérieur": "blueLight2",
    "Formation professionnelle": "blueLight2",
    "Laboratoire": "blueLight2",
    "Musée": "tealLight2",
    "Théâtre": "tealLight2",
    "Bibliothèque": "tealLight2",
    "Monument historique": "tealLight2",
    "Lieu de culte": "tealLight2",
    "Gymnase": "yellowLight2",
    "Stade": "yellowLight2",
    "Piscine": "yellowLight2",
    "Parc": "yellowLight2",
    "Espace public": "yellowLight2",
    "Hôpital": "redLight2",
    "Médico-social": "redLight2",
    "Hébergement d’urgence": "redLight2",
    "Logement collectif": "purpleLight2",
    "Logement individuel": "purpleLight2",
    "Résidence étudiante": "purpleLight2",
    "Résidence Seniors": "purpleLight2",
    "Bureaux": "greenLight1",
    "Administration publique": "greenLight1",
    "Centre communautaire": "greenLight1",
    "Commerce": "orangeLight1",
    "Restauration": "orangeLight1",
    "Hôtel": "orangeLight1",
    "Marché": "orangeLight1",
    "Atelier": "orangeLight1",
    "Usine": "pinkLight1",
    "Entrepôt": "pinkLight1",
    "Gare": "grayLight1",
    "Aéroport": "grayLight1",
    "Parking": "grayLight1",
    "Port": "grayLight1",
    "Pont": "blueBright",
    "Passerelle": "blueBright",
    "Fluvial": "tealDark1",
    "Maritime": "tealDark1",
    "Oeuvre d’art": "orangeDark1",
    "Scénographie": "orangeDark1",
    "Salle de spectacle": "blueDark1"
  },
  "CRM_ROLES": {
    "Client direct": "blueLight2",
    "Prescripteur": "cyanLight2",
    "Cotraitant": "tealLight2",
    "Partenaire ST": "greenLight2",
    "Entreprise": "cyanLight1",
    "Liquidée": "redBright",
    "Aucun": "yellowLight2"
  },
  "CRM_COMPETENCES": {
    "AMO": "orangeLight2",
    "Architecte": "blueLight2",
    "Autre": "grayLight2",
    "Bailleur": "cyanLight2",
    "BET": "purpleLight2",
    "BET Environnement": "cyanLight1",
    "BET Fluide": "blueLight1",
    "BET Naval": "yellowDark1",
    "BET TCE": "tealLight1",
    "Économiste": "yellowLight2",
    "ICC": "blueBright",
    "MOA Privée": "cyanLight2",
    "MOA Publique": "tealLight2",
    "MOA Gestion": "blueLight2",
    "Entreprise": "redLight2",
    "OPC": "greenLight1",
    "Programmiste": "pinkLight2",
    "Scénographe": "grayLight1",
    "Urbaniste": "tealLight2",
    "MOA Particulier": "cyanLight2",
    "Géotechnicien": "greenLight2",
    "MOEX": "pinkLight1",
    "AMO ICC": "blueLight2"
  }
};

// Palette Airtable : nom de couleur → fond, texte.
const PALETTE: Record<string, [string, string]> = {
  blueLight2: ['#CFDFFF', '#102046'], cyanLight2: ['#D0F0FD', '#04283F'], tealLight2: ['#C2F5E9', '#012524'], greenLight2: ['#D1F7C4', '#0B1D05'], yellowLight2: ['#FFEAB6', '#3B2501'],
  orangeLight2: ['#FEE2D5', '#6B2613'], redLight2: ['#FFDCE5', '#4C0C1C'], pinkLight2: ['#FFDAF6', '#400832'], purpleLight2: ['#EDE2FE', '#280B42'], grayLight2: ['#EEEEEE', '#040404'],
  blueLight1: ['#9CC7FF', '#102046'], cyanLight1: ['#77D1F3', '#04283F'], tealLight1: ['#72DDC3', '#012524'], greenLight1: ['#93E088', '#0B1D05'], yellowLight1: ['#FFD66E', '#3B2501'],
  orangeLight1: ['#FFA981', '#6B2613'], redLight1: ['#FF9EB7', '#4C0C1C'], pinkLight1: ['#F99DE2', '#400832'], purpleLight1: ['#CDB0FF', '#280B42'], grayLight1: ['#CCCCCC', '#040404'],
  blueBright: ['#2D7FF9', '#FFFFFF'], cyanBright: ['#18BFFF', '#FFFFFF'], tealBright: ['#20D9D2', '#FFFFFF'], greenBright: ['#20C933', '#FFFFFF'], yellowBright: ['#FCB400', '#FFFFFF'],
  orangeBright: ['#FF6F2C', '#FFFFFF'], redBright: ['#F82B60', '#FFFFFF'], pinkBright: ['#FF08C2', '#FFFFFF'], purpleBright: ['#8B46FF', '#FFFFFF'], grayBright: ['#666666', '#FFFFFF'],
  blueDark1: ['#2750AE', '#FFFFFF'], cyanDark1: ['#0B76B7', '#FFFFFF'], tealDark1: ['#06A09B', '#FFFFFF'], greenDark1: ['#338A17', '#FFFFFF'], yellowDark1: ['#B87503', '#FFFFFF'],
  orangeDark1: ['#D74D26', '#FFFFFF'], redDark1: ['#BA1E45', '#FFFFFF'], pinkDark1: ['#B2158B', '#FFFFFF'], purpleDark1: ['#6B1CB0', '#FFFFFF'], grayDark1: ['#444444', '#FFFFFF'],
};
// Teinte d'une option d'une liste (fond, texte) ; gris clair si inconnue.
export function teinte(liste: string, option: string): { background: string; color: string } {
  const [background, color] = PALETTE[COULEURS[liste]?.[option] || 'grayLight2'] || PALETTE.grayLight2;
  return { background, color };
}

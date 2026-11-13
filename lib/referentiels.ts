// Référentiels Airtable mis en cache : affaires et fiches collaborateur.
import { AFFAIRE, COLLAB, ETATS_CLOS } from './config';
import { lister, memo, texte, nombre, liste } from './airtable';
import { exerciceDe, normNom } from './dates';
import { ErreurHttp } from './erreurs';
import type { AffaireLite } from './types';
import type { Utilisateur } from './session';

export interface Affaire extends AffaireLite {
  libelle: string;
  manager: string;
  cdp: string[];
  marchePI: number | null;     // ADMIN
  coutConsomme: number | null; // ADMIN
}

export function affaires(): Promise<Affaire[]> {
  return memo('ref:affaires', 10 * 60 * 1000, async () => {
    const f = AFFAIRE.f;
    const recs = await lister(AFFAIRE.table, {
      fields: [f.libelle, f.clef, f.nom, f.etat, f.pole, f.manager, f.cdp, f.marchePI, f.coutConsomme],
    });
    return recs
      .map(r => {
        const code = texte(r.fields[f.clef]).trim();
        const libelle = texte(r.fields[f.libelle]).trim();
        const etat = texte(r.fields[f.etat]);
        const pole = texte(r.fields[f.pole]);
        let nom = texte(r.fields[f.nom]).trim();
        if (!nom && libelle.startsWith(code)) nom = libelle.slice(code.length).replace(/^_/, '');
        return {
          id: r.id, code, libelle, nom: nom || libelle, etat, pole,
          clos: ETATS_CLOS.has(etat),
          horsAffaire: pole === 'Autre',
          manager: texte(r.fields[f.manager]),
          cdp: liste(r.fields[f.cdp]),
          marchePI: nombre(r.fields[f.marchePI]),
          coutConsomme: nombre(r.fields[f.coutConsomme]),
        } satisfies Affaire;
      })
      .filter(a => a.code)
      .sort((a, b) => a.code.localeCompare(b.code, 'fr'));
  });
}

export async function affairesParId(): Promise<Map<string, Affaire>> {
  return new Map((await affaires()).map(a => [a.id, a]));
}
export function versLite(a: Affaire): AffaireLite {
  return { id: a.id, code: a.code, nom: a.nom, etat: a.etat, pole: a.pole, clos: a.clos, horsAffaire: a.horsAffaire };
}

// ── Collaborateurs ───────────────────────────────────────────────────────
export interface Fiche {
  id: string;
  cle: string;      // « Prénom - 26/27 »
  prenom: string;
  exercice: string;
  cout: number | null; // ADMIN
  email: string;
  nom: string;
  idPayfit: string;
}

export function fiches(): Promise<Fiche[]> {
  return memo('ref:fiches', 10 * 60 * 1000, async () => {
    const f = COLLAB.f;
    const recs = await lister(COLLAB.table, { fields: [f.cle, f.prenom, f.exercice, f.cout, f.email, f.nom, f.idPayfit] });
    return recs.map(r => ({
      id: r.id,
      cle: texte(r.fields[f.cle]),
      prenom: texte(r.fields[f.prenom]).trim(),
      exercice: texte(r.fields[f.exercice]).trim(),
      cout: nombre(r.fields[f.cout]),
      email: texte(r.fields[f.email]).trim().toLowerCase(),
      nom: texte(r.fields[f.nom]).trim(),
      idPayfit: texte(r.fields[f.idPayfit]).trim(),
    })).filter(x => x.prenom);
  });
}

// Une personne (indépendamment de l'exercice), identifiée par son prénom tel
// qu'il figure dans Airtable — c'est la clé historique de « Prénom - exercice ».
export interface Personne { prenom: string; nom: string; email: string | null; idPayfit: string }

function personneDepuis(toutes: Fiche[], prenom: string, defautNom = '', defautEmail: string | null = null): Personne {
  const siennes = toutes.filter(x => x.prenom === prenom);
  return {
    prenom,
    nom: siennes.find(x => x.nom)?.nom || defautNom,
    email: siennes.find(x => x.email)?.email || defautEmail,
    idPayfit: siennes.find(x => x.idPayfit)?.idPayfit || '',
  };
}

// Personne correspondant au compte connecté :
//  1. une fiche porte son Email ;
//  2. sinon, le prénom Google correspond à un seul prénom des fiches de l'exercice en cours.
export async function personneDuCompte(u: Utilisateur, aujourdhui: string): Promise<Personne> {
  const toutes = await fiches();
  const parEmail = toutes.find(x => x.email === u.email);
  if (parEmail) return personneDepuis(toutes, parEmail.prenom, u.famille, u.email);
  const ex = exerciceDe(aujourdhui);
  const g = normNom(u.prenom);
  const candidats = [...new Set(toutes.filter(x => x.exercice === ex && normNom(x.prenom) === g).map(x => x.prenom))];
  if (candidats.length === 1) return personneDepuis(toutes, candidats[0], u.famille, u.email);
  throw new ErreurHttp(404, candidats.length > 1
    ? `Plusieurs fiches Collaborateur portent le prénom « ${u.prenom} ». Renseignez votre email dans le champ Email de votre fiche Airtable.`
    : `Aucune fiche Collaborateur ne correspond à ${u.email}. Demandez à un administrateur de renseigner votre email dans Airtable (table Collaborateur, champ Email).`);
}

export async function personneParPrenom(prenom: string): Promise<Personne> {
  const toutes = await fiches();
  if (!toutes.some(x => x.prenom === prenom)) throw new ErreurHttp(404, `Collaborateur « ${prenom} » introuvable`);
  return personneDepuis(toutes, prenom);
}

export async function ficheDe(prenom: string, exercice: string): Promise<Fiche | null> {
  return (await fiches()).find(x => x.prenom === prenom && x.exercice === exercice) || null;
}

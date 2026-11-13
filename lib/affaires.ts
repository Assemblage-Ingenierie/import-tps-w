// Écritures sur la table Affaire depuis Carnet : se déclarer (ou ne plus être)
// Chef·fe de projet, et changer l'état interne d'une affaire.
// ATTENTION : c'est la vraie table Affaire (pas d'équivalent TEST).
import { AFFAIRE } from './config';
import { lister, modifier, texte, liste, chaine, oublier } from './airtable';
import { normNom } from './dates';
import { ErreurHttp } from './erreurs';
import type { Utilisateur } from './session';
import type { Personne } from './referentiels';

// États proposés, dans l'ordre de vie d'une affaire (options de « Etat interne »).
export const ETATS = ['AO', 'Etude', 'Chantier', 'En Cours', 'Livré', 'Terminé', 'Annulé', 'Interrompu'];

// Lecture fraîche (sans cache) : on écrit à partir de la valeur actuelle.
async function lireAffaire(id: string) {
  if (!/^rec[A-Za-z0-9]{14}$/.test(id)) throw new ErreurHttp(400, 'Affaire invalide');
  const f = AFFAIRE.f;
  const r = (await lister(AFFAIRE.table, { fields: [f.cdp, f.manager, f.etat], filterByFormula: `RECORD_ID()=${chaine(id)}`, max: 1 }))[0];
  if (!r) throw new ErreurHttp(404, 'Affaire introuvable');
  return { cdp: liste(r.fields[f.cdp]), manager: texte(r.fields[f.manager]), etat: texte(r.fields[f.etat]) };
}

export function peutGerer(u: Utilisateur, p: Personne, a: { cdp: string[]; manager: string }): boolean {
  const n = normNom(p.prenom);
  return u.role === 'admin' || a.cdp.some(x => normNom(x) === n) || normNom(a.manager) === n;
}

// Ajoute ou retire le prénom de la personne dans le champ CDP (choix multiples) ;
// les autres Chef·fe·s de projet sont conservés.
export async function definirCdp(p: Personne, id: string, ajouter: boolean): Promise<void> {
  const a = await lireAffaire(id);
  const n = normNom(p.prenom);
  const deja = a.cdp.some(x => normNom(x) === n);
  if (ajouter === deja) return;
  const cdp = ajouter ? [...a.cdp, p.prenom] : a.cdp.filter(x => normNom(x) !== n);
  await modifier(AFFAIRE.table, [{ id, fields: { [AFFAIRE.f.cdp]: cdp } }]);
  oublier('ref:affaires');
}

// Change l'état interne : réservé au Chef·fe de projet, au Manager ou à un Admin.
export async function definirEtat(u: Utilisateur, p: Personne, id: string, etat: string): Promise<void> {
  if (!ETATS.includes(etat)) throw new ErreurHttp(400, 'État inconnu');
  const a = await lireAffaire(id);
  if (!peutGerer(u, p, a)) throw new ErreurHttp(403, 'Seul le Chef·fe de projet, le Manager ou un Admin peut changer l’état de cette affaire.');
  if (a.etat === etat) return;
  await modifier(AFFAIRE.table, [{ id, fields: { [AFFAIRE.f.etat]: etat } }]);
  oublier('ref:affaires');
}

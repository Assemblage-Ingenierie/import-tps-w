// Qui est concerné par une requête ? Un User agit toujours sur lui-même : le
// paramètre `prenom` n'est accepté que d'un Admin.
import { aujourdhuiParis } from './dates';
import { ErreurHttp } from './erreurs';
import { personneDuCompte, personneParPrenom, type Personne } from './referentiels';
import type { Utilisateur } from './session';

export async function personneCible(u: Utilisateur, prenom: string | null | undefined): Promise<Personne> {
  if (prenom) {
    if (u.role !== 'admin') throw new ErreurHttp(403, 'Réservé aux administrateurs');
    return personneParPrenom(prenom);
  }
  return personneDuCompte(u, aujourdhuiParis());
}

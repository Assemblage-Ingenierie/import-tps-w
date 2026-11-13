// Garde serveur des routes API et des pages. Tout contrôle de rôle passe ici :
// le navigateur n'est jamais cru sur parole.
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE, lireJeton, type Utilisateur } from './session';
import { ErreurHttp } from './erreurs';
export { ErreurHttp };

export async function utilisateurCourant(): Promise<Utilisateur | null> {
  const c = await cookies();
  return lireJeton(c.get(COOKIE)?.value);
}


export async function exigerUtilisateur(): Promise<Utilisateur> {
  const u = await utilisateurCourant();
  if (!u) throw new ErreurHttp(401, 'Non authentifié');
  return u;
}
export async function exigerAdmin(): Promise<Utilisateur> {
  const u = await exigerUtilisateur();
  if (u.role !== 'admin') throw new ErreurHttp(403, 'Réservé aux administrateurs');
  return u;
}

// Enveloppe commune des handlers : transforme les erreurs en réponses JSON.
export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function gerer(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErreurHttp) return json({ erreur: e.message, ...(e.extra || {}) }, e.status);
    console.error(e);
    return json({ erreur: 'Erreur serveur', detail: String((e as Error)?.message || e) }, 500);
  }
}

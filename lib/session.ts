// Session applicative : JWT HS256 signé avec SESSION_SECRET, en cookie HttpOnly.
// Le jeton Google ne sert qu'une fois, à la connexion.
//
// Le rôle n'est PAS stocké dans le cookie : il est recalculé à chaque requête
// à partir de ADMIN_EMAILS. Retirer quelqu'un de la liste lui retire les droits
// Admin à la requête suivante.
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'tpsw_session';
// Vue choisie par un Admin (« user » pour utiliser l'appli comme un salarié).
// Ce cookie ne peut que RETIRER des droits : le rôle Admin vient toujours
// d'ADMIN_EMAILS, jamais du navigateur.
export const COOKIE_VUE = 'tpsw_vue';
export const DUREE_S = 12 * 3600;

export interface Session {
  email: string;
  nom: string;     // nom complet affiché (Google)
  prenom: string;  // given_name Google
  famille: string; // family_name Google
}
export type Role = 'admin' | 'user';
export interface Utilisateur extends Session {
  role: Role;        // rôle effectif (vue courante)
  estAdmin: boolean; // Admin d'après ADMIN_EMAILS, quelle que soit la vue
}

function cle(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  // Sans secret, on refuse de signer : mieux vaut une app en panne qu'ouverte.
  if (!s || s.length < 32) throw new Error('SESSION_SECRET absent ou trop court (48 octets aléatoires attendus)');
  return new TextEncoder().encode(s);
}

export async function creerSession(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('tpsw')
    .setAudience('tpsw')
    .setExpirationTime(`${DUREE_S}s`)
    .sign(cle());
}

export function domaineAutorise(): string {
  return (process.env.ALLOWED_HD || 'assemblage.net').toLowerCase();
}

export function estEmailDuDomaine(email: string): boolean {
  return String(email || '').toLowerCase().endsWith('@' + domaineAutorise());
}

// Admins : ADMIN_EMAILS. Repli sur l'ancienne liste ALLOWED_EMAILS, dont les
// membres étaient de fait tous Admins avant l'ouverture aux salariés.
export function listeAdmins(): string[] {
  const brut = process.env.ADMIN_EMAILS ?? process.env.ALLOWED_EMAILS ?? '';
  return brut.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
export function roleDe(email: string): Role {
  return listeAdmins().includes(String(email || '').toLowerCase()) ? 'admin' : 'user';
}

export async function lireJeton(jeton: string | null | undefined, vue?: string | null): Promise<Utilisateur | null> {
  if (!jeton) return null;
  try {
    const { payload } = await jwtVerify(jeton, cle(), { issuer: 'tpsw', audience: 'tpsw' });
    const email = String(payload.email || '').toLowerCase();
    if (!estEmailDuDomaine(email)) return null;
    return {
      email,
      nom: String(payload.nom || ''),
      prenom: String(payload.prenom || ''),
      famille: String(payload.famille || ''),
      role: roleDe(email) === 'admin' && vue !== 'user' ? 'admin' : 'user',
      estAdmin: roleDe(email) === 'admin',
    };
  } catch {
    return null;
  }
}

export function enteteCookie(valeur: string, maxAge: number): string {
  const bits = [`${COOKIE}=${valeur}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (process.env.VERCEL) bits.push('Secure');
  return bits.join('; ');
}

export function enteteCookieVue(vue: Role): string {
  const bits = [`${COOKIE_VUE}=${vue}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${30 * 24 * 3600}`];
  if (process.env.VERCEL) bits.push('Secure');
  return bits.join('; ');
}

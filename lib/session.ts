// Session applicative : JWT HS256 signé avec SESSION_SECRET, en cookie HttpOnly.
// Le jeton Google ne sert qu'une fois, à la connexion.
//
// Le rôle n'est PAS stocké dans le cookie : il est recalculé à chaque requête
// à partir de ADMIN_EMAILS. Retirer quelqu'un de la liste lui retire les droits
// Admin à la requête suivante.
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'tpsw_session';
export const DUREE_S = 12 * 3600;

export interface Session {
  email: string;
  nom: string;     // nom complet affiché (Google)
  prenom: string;  // given_name Google
  famille: string; // family_name Google
}
export type Role = 'admin' | 'user';
export interface Utilisateur extends Session { role: Role }

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

export async function lireJeton(jeton: string | null | undefined): Promise<Utilisateur | null> {
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
      role: roleDe(email),
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

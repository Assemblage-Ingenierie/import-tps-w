// Session applicative : un JWT court signé avec SESSION_SECRET, posé en cookie
// HttpOnly. Le jeton Google ne sert qu'une fois, à la connexion ; il n'est ni
// stocké ni renvoyé au navigateur ensuite.
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'tpsw_session';
const DUREE_H = 12;

function cle() {
  const s = process.env.SESSION_SECRET;
  // Sans secret, on refuse de signer plutôt que de produire des sessions
  // falsifiables : mieux vaut une app en panne qu'une app ouverte.
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET absent ou trop court (48 octets aléatoires attendus)');
  }
  return new TextEncoder().encode(s);
}

export async function creerSession(email, nom) {
  return new SignJWT({ email, nom })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('tpsw')
    .setAudience('tpsw')
    .setExpirationTime(`${DUREE_H}h`)
    .sign(cle());
}

export async function lireSession(req) {
  const brut = cookie(req, COOKIE);
  if (!brut) return null;
  try {
    const { payload } = await jwtVerify(brut, cle(), { issuer: 'tpsw', audience: 'tpsw' });
    // Une adresse retirée de la liste perd l'accès à la prochaine requête,
    // sans attendre l'expiration du cookie.
    if (!estAutorise(payload.email)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function cookie(req, nom) {
  const brut = req.headers?.cookie || req.headers?.get?.('cookie') || '';
  for (const part of brut.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === nom) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function enteteCookie(valeur, maxAge) {
  const bits = [
    `${COOKIE}=${valeur}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  // En local (vercel dev) l'origine est http, Secure empêcherait la pose.
  if (process.env.VERCEL) bits.push('Secure');
  return bits.join('; ');
}

// Liste d'adresses autorisées. Une liste absente ou vide ferme l'accès à tout
// le monde — un déploiement mal configuré ne doit jamais s'ouvrir par défaut.
export function listeAutorisee() {
  return String(process.env.ALLOWED_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

export function estAutorise(email) {
  const liste = listeAutorisee();
  if (!liste.length) return false;
  return liste.includes(String(email || '').trim().toLowerCase());
}

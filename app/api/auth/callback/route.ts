// Reçoit le jeton d'identité Google, le vérifie et ouvre une session.
// Accès ouvert à tout compte Google Workspace du domaine (ALLOWED_HD,
// assemblage.net par défaut). Rôle Admin : ADMIN_EMAILS.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { creerSession, enteteCookie, domaineAutorise, DUREE_S } from '@/lib/session';
import { json } from '@/lib/auth';

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function POST(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return json({ erreur: 'GOOGLE_CLIENT_ID non configuré' }, 500);
  const corps = await req.json().catch(() => ({}));
  const credential = corps?.credential;
  if (!credential || typeof credential !== 'string') return json({ erreur: 'Jeton manquant' }, 400);

  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(credential, JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    }));
  } catch {
    return json({ erreur: 'Jeton Google invalide' }, 401);
  }
  if (!payload.email_verified) return json({ erreur: 'Adresse Google non vérifiée' }, 403);

  // Le domaine est contrôlé côté serveur : le paramètre `hd` côté client n'est qu'un affichage.
  const hd = domaineAutorise();
  const email = String(payload.email || '').toLowerCase();
  if (payload.hd !== hd || !email.endsWith('@' + hd)) {
    return json({ erreur: 'Accès non autorisé', detail: `Connectez-vous avec votre compte @${hd}.` }, 403);
  }

  const jeton = await creerSession({
    email,
    nom: String(payload.name || ''),
    prenom: String(payload.given_name || ''),
    famille: String(payload.family_name || ''),
  });
  const res = json({ ok: true, email });
  res.headers.set('Set-Cookie', enteteCookie(jeton, DUREE_S));
  return res;
}

// Reçoit le jeton d'identité Google émis par le bouton de connexion, le
// vérifie, applique la liste d'accès, et ouvre une session applicative.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { creerSession, enteteCookie, estAutorise } from '../_session.js';

// Clés publiques Google, mises en cache par jose entre les invocations chaudes.
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erreur: 'Méthode non autorisée' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ erreur: 'GOOGLE_CLIENT_ID non configuré' });

  // Le corps peut arriver déjà décodé ou brut selon le runtime.
  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch { corps = {}; } }
  const credential = corps?.credential;
  if (!credential) return res.status(400).json({ erreur: 'Jeton manquant' });

  let payload;
  try {
    ({ payload } = await jwtVerify(credential, JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    }));
  } catch (e) {
    return res.status(401).json({ erreur: 'Jeton Google invalide' });
  }

  if (!payload.email_verified) {
    return res.status(403).json({ erreur: 'Adresse Google non vérifiée' });
  }

  // Le domaine Workspace est contrôlé côté serveur : le paramètre `hd` envoyé
  // par le client n'est qu'une suggestion d'affichage, il ne prouve rien.
  const hdAttendu = process.env.ALLOWED_HD;
  if (hdAttendu && payload.hd !== hdAttendu) {
    return res.status(403).json({ erreur: `Compte hors du domaine ${hdAttendu}` });
  }

  if (!estAutorise(payload.email)) {
    return res.status(403).json({
      erreur: 'Accès non autorisé',
      detail: `${payload.email} ne figure pas dans la liste d'accès de cette application.`,
    });
  }

  const session = await creerSession(payload.email, payload.name || '');
  res.setHeader('Set-Cookie', enteteCookie(session, 12 * 3600));
  return res.status(200).json({ ok: true, email: payload.email, nom: payload.name || '' });
}

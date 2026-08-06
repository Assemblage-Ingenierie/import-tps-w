// Renvoie l'identité de la session courante et l'identifiant client Google,
// pour que la page de connexion n'ait pas à l'embarquer en dur.
import { lireSession } from './_session.js';

export default async function handler(req, res) {
  const s = await lireSession(req).catch(() => null);
  return res.status(200).json({
    connecte: !!s,
    email: s?.email || null,
    nom: s?.nom || null,
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    domaine: process.env.ALLOWED_HD || null,
  });
}

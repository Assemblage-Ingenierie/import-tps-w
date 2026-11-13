// Identité de la session et configuration publique de la page de connexion.
// Format conservé pour l'ancien outil Admin (connecte, email, nom, clientId, domaine).
import { utilisateurCourant, json } from '@/lib/auth';
import { domaineAutorise } from '@/lib/session';

export async function GET() {
  const u = await utilisateurCourant().catch(() => null);
  return json({
    connecte: !!u,
    email: u?.email || null,
    nom: u?.nom || null,
    role: u?.role || null,
    estAdmin: u?.estAdmin || false,
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    domaine: domaineAutorise(),
  });
}

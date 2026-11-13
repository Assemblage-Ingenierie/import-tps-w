// Commentaires d'un mois.
//   GET    ?ym=2026-11[&prenom=]       commentaires du mois
//   GET    ?tous=1[&prenom=]           tous les commentaires de la personne
//   POST   { ym, prenom?, texte }      ajoute un commentaire
//   PATCH  { id, texte }               modifie un de SES commentaires
//   DELETE ?id=rec…                    supprime un de SES commentaires
import { exigerUtilisateur, gerer, json, ErreurHttp } from '@/lib/auth';
import { estMoisValide } from '@/lib/dates';
import { personneCible } from '@/lib/cible';
import { commentaires, commentairesDe, ajouterCommentaire, modifierCommentaire, supprimerCommentaire } from '@/lib/mois';

export async function GET(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const q = new URL(req.url).searchParams;
    const p = await personneCible(u, q.get('prenom'));
    if (q.get('tous') === '1') return json(await commentairesDe(p, u.email));
    const ym = q.get('ym');
    if (!estMoisValide(ym)) throw new ErreurHttp(400, 'Mois invalide');
    return json(await commentaires(p, ym, u.email));
  });
}

export async function POST(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const b = await req.json().catch(() => ({}));
    if (!estMoisValide(b.ym)) throw new ErreurHttp(400, 'Mois invalide');
    const p = await personneCible(u, b.prenom);
    await ajouterCommentaire(u, p, b.ym, b.texte);
    return json(await commentaires(p, b.ym, u.email));
  });
}

export async function PATCH(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const b = await req.json().catch(() => ({}));
    await modifierCommentaire(u, String(b.id || ''), b.texte);
    return json({ ok: true });
  });
}

export async function DELETE(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    await supprimerCommentaire(u, String(new URL(req.url).searchParams.get('id') || ''));
    return json({ ok: true });
  });
}

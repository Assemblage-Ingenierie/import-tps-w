import { exigerUtilisateur, gerer, json, ErreurHttp } from '@/lib/auth';
import { estMoisValide } from '@/lib/dates';
import { personneCible } from '@/lib/cible';
import { commentaires, ajouterCommentaire } from '@/lib/mois';

export async function GET(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const q = new URL(req.url).searchParams;
    const ym = q.get('ym');
    if (!estMoisValide(ym)) throw new ErreurHttp(400, 'Mois invalide');
    return json(await commentaires(await personneCible(u, q.get('prenom')), ym));
  });
}

export async function POST(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const b = await req.json().catch(() => ({}));
    if (!estMoisValide(b.ym)) throw new ErreurHttp(400, 'Mois invalide');
    const p = await personneCible(u, b.prenom);
    await ajouterCommentaire(u, p, b.ym, b.texte);
    return json(await commentaires(p, b.ym));
  });
}

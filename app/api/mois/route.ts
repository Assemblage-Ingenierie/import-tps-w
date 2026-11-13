// Mois de saisie : lecture (GET), enregistrement de créneaux (PUT), workflow (POST).
//   GET  ?ym=2026-11[&prenom=Pierre (Admin)]
//   PUT  { ym, prenom?, changements: Changement[] }
//   POST { ym, prenom?, action: 'soumettre' | 'valider' | 'refuser' | 'rouvrir', motif? }
import { exigerUtilisateur, gerer, json, ErreurHttp } from '@/lib/auth';
import { estMoisValide } from '@/lib/dates';
import { personneCible } from '@/lib/cible';
import { donneesMois, enregistrer, soumettre, decider } from '@/lib/mois';

export async function GET(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const q = new URL(req.url).searchParams;
    const ym = q.get('ym');
    if (!estMoisValide(ym)) throw new ErreurHttp(400, 'Mois invalide');
    const p = await personneCible(u, q.get('prenom'));
    return json(await donneesMois(u, p, ym));
  });
}

export async function PUT(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const b = await req.json().catch(() => ({}));
    if (!estMoisValide(b.ym)) throw new ErreurHttp(400, 'Mois invalide');
    if (!Array.isArray(b.changements) || !b.changements.length || b.changements.length > 80) throw new ErreurHttp(400, 'Changements invalides');
    const p = await personneCible(u, b.prenom);
    return json(await enregistrer(u, p, b.ym, b.changements));
  });
}

export async function POST(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const b = await req.json().catch(() => ({}));
    if (!estMoisValide(b.ym)) throw new ErreurHttp(400, 'Mois invalide');
    const p = await personneCible(u, b.prenom);
    if (b.action === 'soumettre') return json(await soumettre(u, p, b.ym));
    if (['valider', 'refuser', 'rouvrir'].includes(b.action)) return json(await decider(u, p, b.ym, b.action, b.motif));
    throw new ErreurHttp(400, 'Action inconnue');
  });
}

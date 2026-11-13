// Bilan de l'exercice pour le récap « Mon année » : uniquement les jours
// saisis par la personne (aucun montant). GET [?prenom= (Admin)]
import { exigerUtilisateur, gerer, json } from '@/lib/auth';
import { personneCible } from '@/lib/cible';
import { saisiesExercice } from '@/lib/temps';
import { affairesParId } from '@/lib/referentiels';
import { aujourdhuiParis, exerciceDe } from '@/lib/dates';
import { memo } from '@/lib/airtable';

export async function GET(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const p = await personneCible(u, new URL(req.url).searchParams.get('prenom'));
    const ex = exerciceDe(aujourdhuiParis());
    const [saisies, affaires] = await Promise.all([
      memo(`bilan:${p.prenom}:${ex}`, 5 * 60 * 1000, () => saisiesExercice(ex, p.prenom)),
      affairesParId(),
    ]);
    const parAffaire = new Map<string, number>();
    const parMois = new Map<string, number>();
    const parPole = new Map<string, number>();
    const joursTravailles = new Set<string>();
    let total = 0, horsAffaire = 0;
    for (const s of saisies) {
      if (!s.affaireId || !s.date) continue;
      const a = affaires.get(s.affaireId);
      total += s.temps;
      joursTravailles.add(s.date);
      parMois.set(s.date.slice(0, 7), (parMois.get(s.date.slice(0, 7)) || 0) + s.temps);
      if (a?.horsAffaire) { horsAffaire += s.temps; continue; }
      parAffaire.set(s.affaireId, (parAffaire.get(s.affaireId) || 0) + s.temps);
      if (a?.pole) parPole.set(a.pole, (parPole.get(a.pole) || 0) + s.temps);
    }
    const top = [...parAffaire].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([id, jours]) => ({ code: affaires.get(id)?.code || '?', nom: affaires.get(id)?.nom || '', jours }));
    return json({
      exercice: ex,
      prenom: p.prenom,
      total,
      horsAffaire,
      nbAffaires: parAffaire.size,
      nbJours: joursTravailles.size,
      top,
      parMois: Object.fromEntries([...parMois].sort()),
      parPole: Object.fromEntries([...parPole].sort((a, b) => b[1] - a[1])),
    });
  });
}

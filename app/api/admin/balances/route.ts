// Balances (Admin) : « Rentabilité globale » et « Rentabilité 25/26 » lues dans
// Airtable (formules), et jours saisis sur l'exercice par collaborateur.
import { exigerAdmin, gerer, json } from '@/lib/auth';
import { affaires, fiches } from '@/lib/referentiels';
import { saisiesExercice } from '@/lib/temps';
import { aujourdhuiParis, exerciceDe } from '@/lib/dates';
import { memo } from '@/lib/airtable';
import { LIBELLE_RENTA_GLOBALE, LIBELLE_RENTA_EXERCICE } from '@/lib/config';
import type { LigneBalance } from '@/lib/types';

export async function GET() {
  return gerer(async () => {
    await exigerAdmin();
    const ex = exerciceDe(aujourdhuiParis());
    const [toutes, fs, saisies] = await Promise.all([
      affaires(), fiches(), memo(`balances:${ex}`, 10 * 60 * 1000, () => saisiesExercice(ex)),
    ]);
    const cout = new Map(fs.filter(f => f.exercice === ex).map(f => [f.prenom, f.cout]));
    const parAff = new Map<string, Map<string, number>>();
    for (const s of saisies) {
      if (!s.affaireId) continue;
      const m = parAff.get(s.affaireId) || new Map<string, number>();
      m.set(s.prenom, (m.get(s.prenom) || 0) + s.temps);
      parAff.set(s.affaireId, m);
    }
    const lignes: LigneBalance[] = toutes
      .filter(a => !a.horsAffaire && (a.marchePI != null || a.rentaGlobale != null || parAff.has(a.id)))
      .map(a => {
        const parCollab = [...(parAff.get(a.id) || new Map<string, number>()).entries()].map(([prenom, jours]) => {
          const c = cout.get(prenom) ?? null;
          return { prenom, jours, cout: c };
        }).sort((x, y) => y.jours - x.jours);
        return { id: a.id, code: a.code, nom: a.nom, etat: a.etat, pole: a.pole, marchePI: a.marchePI, rentaGlobale: a.rentaGlobale, rentaExercice: a.rentaExercice, parCollab };
      });
    return json({ exercice: ex, libelles: { globale: LIBELLE_RENTA_GLOBALE, exercice: LIBELLE_RENTA_EXERCICE }, lignes });
  });
}

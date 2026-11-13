// Balances (Admin) : par affaire, Marché PI − coût consommé (champ Airtable
// « Coût 26/27 », décision du 12/11/2026) ; par collaborateur, jours saisis sur
// l'exercice et balance exprimée en jours de ce collaborateur (÷ son coût journalier).
import { exigerAdmin, gerer, json } from '@/lib/auth';
import { affaires, fiches } from '@/lib/referentiels';
import { saisiesExercice } from '@/lib/temps';
import { aujourdhuiParis, exerciceDe } from '@/lib/dates';
import { memo } from '@/lib/airtable';
import { LIBELLE_COUT_CONSOMME } from '@/lib/config';
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
      .filter(a => !a.horsAffaire && (a.marchePI != null || parAff.has(a.id)))
      .map(a => {
        const balance = a.marchePI != null ? a.marchePI - (a.coutConsomme || 0) : null;
        const parCollab = [...(parAff.get(a.id) || new Map<string, number>()).entries()].map(([prenom, jours]) => {
          const c = cout.get(prenom) ?? null;
          return { prenom, jours, cout: c, balanceJours: balance != null && c ? balance / c : null };
        }).sort((x, y) => y.jours - x.jours);
        return { id: a.id, code: a.code, nom: a.nom, etat: a.etat, pole: a.pole, marchePI: a.marchePI, coutConsomme: a.coutConsomme, balance, parCollab };
      });
    return json({ exercice: ex, libelleCout: LIBELLE_COUT_CONSOMME, lignes });
  });
}

// Tableau de validation mensuelle : un collaborateur par ligne (fiches de
// l'exercice du mois), statut, complétude, points d'attention.
import { exigerAdmin, gerer, json, ErreurHttp } from '@/lib/auth';
import { estMoisValide, exerciceDe, joursDuMois, estOuvre } from '@/lib/dates';
import { fiches, affairesParId } from '@/lib/referentiels';
import { saisiesDeTousLeMois, type Saisie } from '@/lib/temps';
import { statutsDuMois, cleMois, validerEnLot } from '@/lib/mois';
import { chargerAbsences, absencesDe } from '@/lib/payfit';
import type { LigneValidation, Creneau } from '@/lib/types';

const CRENEAUX: Creneau[] = ['AM', 'PM'];

export async function GET(req: Request) {
  return gerer(async () => {
    await exigerAdmin();
    const ym = new URL(req.url).searchParams.get('ym');
    if (!estMoisValide(ym)) throw new ErreurHttp(400, 'Mois invalide');
    const ex = exerciceDe(ym + '-01');
    const [toutes, saisies, statuts, index, affaires] = await Promise.all([
      fiches(), saisiesDeTousLeMois(ym), statutsDuMois(ym), chargerAbsences().catch(() => null), affairesParId(),
    ]);
    const ouvres = joursDuMois(ym).filter(estOuvre);
    const lignes: LigneValidation[] = toutes.filter(f => f.exercice === ex).map(f => {
      const nom = toutes.find(x => x.prenom === f.prenom && x.nom)?.nom || f.nom;
      const email = toutes.find(x => x.prenom === f.prenom && x.email)?.email || null;
      const siennes = saisies.filter(s => s.prenom === f.prenom);
      const occ = new Map<string, Saisie>();
      for (const s of siennes) for (const c of s.creneau ? [s.creneau] : CRENEAUX) if (!occ.has(`${s.date}|${c}`)) occ.set(`${s.date}|${c}`, s);
      const abs = index ? absencesDe(index, f.prenom, nom) : new Set<string>();
      let attendus = 0, couverts = 0, conflits = 0;
      for (const d of ouvres) for (const c of CRENEAUX) {
        attendus++;
        const s = occ.get(`${d}|${c}`);
        const a = abs.has(`${d}|${c}`);
        if (a || s?.affaireId) couverts++;
        if (a && s?.affaireId) conflits++;
      }
      const st = statuts.get(cleMois(f.prenom, ym));
      return {
        cle: f.cle, prenom: f.prenom, nom, ficheId: f.id, email,
        statut: st?.statut || 'A compléter', soumisLe: st?.soumisLe || null,
        attendus, couverts, conflits,
        clotureesMaintenues: siennes.filter(s => s.confirmClot || (!!s.affaireId && !!affaires.get(s.affaireId)?.clos)).length,
        nonOuvresConfirmes: siennes.filter(s => s.confirmNonOuvre).length,
      };
    }).sort((a, b) => a.prenom.localeCompare(b.prenom, 'fr'));
    return json({ ym, lignes });
  });
}

// Validation en lot : { ym, prenoms: string[] }.
export async function POST(req: Request) {
  return gerer(async () => {
    const u = await exigerAdmin();
    const b = await req.json().catch(() => ({}));
    if (!estMoisValide(b.ym)) throw new ErreurHttp(400, 'Mois invalide');
    if (!Array.isArray(b.prenoms) || !b.prenoms.length || b.prenoms.length > 200 || !b.prenoms.every((x: unknown) => typeof x === 'string')) {
      throw new ErreurHttp(400, 'Liste de collaborateurs invalide');
    }
    return json(await validerEnLot(u, b.prenoms, b.ym));
  });
}

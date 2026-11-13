// Affaires pour le sélecteur, et « Mes affaires » (Chef·fe de projet / Manager).
// Aucun montant n'est renvoyé, sauf la balance si l'Admin l'a rendue visible.
import { exigerUtilisateur, gerer, json } from '@/lib/auth';
import { affaires, versLite, fiches } from '@/lib/referentiels';
import { personneCible } from '@/lib/cible';
import { saisiesExercice } from '@/lib/temps';
import { balanceVisibleUsers } from '@/lib/mois';
import { aujourdhuiParis, exerciceDe, normNom } from '@/lib/dates';
import { memo } from '@/lib/airtable';
import type { AffaireMienne } from '@/lib/types';

export async function GET(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const q = new URL(req.url).searchParams;
    const toutes = await affaires();
    const liste = toutes.map(versLite);
    if (q.get('mes') !== '1') return json({ affaires: liste });

    const p = await personneCible(u, q.get('prenom'));
    const ex = exerciceDe(aujourdhuiParis());
    const n = normNom(p.prenom);
    const saisies = await memo(`mes:${p.prenom}:${ex}`, 5 * 60 * 1000, () => saisiesExercice(ex, p.prenom));
    const jours = new Map<string, number>();
    for (const s of saisies) if (s.affaireId) jours.set(s.affaireId, (jours.get(s.affaireId) || 0) + s.temps);

    // Balance : jamais envoyée à un User tant que le paramètre Admin est désactivé.
    const voirBalance = u.role === 'admin' || (await balanceVisibleUsers()).actif;

    const mes: AffaireMienne[] = [];
    for (const a of toutes) {
      const roles: string[] = [];
      if (a.cdp.some(x => normNom(x) === n)) roles.push('Chef·fe de projet');
      if (normNom(a.manager) === n) roles.push('Manager');
      if (!roles.length) continue;
      const m: AffaireMienne = { ...versLite(a), role: roles.join(' · '), joursExercice: jours.get(a.id) || 0 };
      if (voirBalance) {
        const b = a.rentaGlobale; // formule Airtable « Rentabilité Globale »
        m.balance = b;
      }
      mes.push(m);
    }
    return json({ affaires: liste, mes, exercice: ex, balanceVisible: voirBalance });
  });
}

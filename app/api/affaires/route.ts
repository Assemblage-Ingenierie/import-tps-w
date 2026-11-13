// Affaires pour le sélecteur, et « Mes affaires » (Chef·fe de projet / Manager).
// Aucun montant n'est renvoyé, sauf la balance si l'Admin l'a rendue visible.
import { exigerUtilisateur, gerer, json, ErreurHttp } from '@/lib/auth';
import { definirCdp, definirEtat, peutGerer } from '@/lib/affaires';
import { affaires, versLite, fiches } from '@/lib/referentiels';
import { personneCible } from '@/lib/cible';
import { saisiesExercice } from '@/lib/temps';
import { balanceVisibleUsers } from '@/lib/mois';
import { aujourdhuiParis, exerciceDe, normNom } from '@/lib/dates';
import { memo, oublier } from '@/lib/airtable';
import type { AffaireMienne } from '@/lib/types';

export async function GET(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const q = new URL(req.url).searchParams;
    if (q.get('frais') === '1') oublier('ref:affaires'); // après une modification
    const toutes = await affaires();
    const liste = toutes.map(versLite);
    if (q.get('mes') !== '1') return json({ affaires: liste });

    const p = await personneCible(u, q.get('prenom'));
    const listeG = toutes.map(a => ({ ...versLite(a), gerable: peutGerer(u, p, a) }));
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
      const m: AffaireMienne = { ...versLite(a), gerable: peutGerer(u, p, a), role: roles.join(' · '), joursExercice: jours.get(a.id) || 0 };
      if (voirBalance) {
        const b = a.rentaGlobale; // formule Airtable « Rentabilité Globale »
        m.balance = b;
      }
      mes.push(m);
    }
    return json({ affaires: listeG, mes, exercice: ex, balanceVisible: voirBalance });
  });
}

// Actions sur une affaire, pour le compte connecté :
//   { action: 'cdp', affaireId, ajouter: boolean }  se déclarer / ne plus être Chef·fe de projet
//   { action: 'etat', affaireId, etat }               changer l'état interne (CDP, Manager ou Admin)
export async function POST(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    const b = await req.json().catch(() => ({}));
    const p = await personneCible(u, null);
    const id = String(b.affaireId || '');
    if (b.action === 'cdp') await definirCdp(p, id, b.ajouter !== false);
    else if (b.action === 'etat') await definirEtat(u, p, id, String(b.etat || ''));
    else throw new ErreurHttp(400, 'Action inconnue');
    return json({ ok: true });
  });
}

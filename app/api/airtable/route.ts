// Relais Airtable générique de l'ancien outil Admin (import Payfit, bilan).
// RÉSERVÉ AUX ADMINS : il donne accès à toute la base avec le token serveur.
import { NextResponse } from 'next/server';
import { exigerAdmin, gerer, json } from '@/lib/auth';
import { brut } from '@/lib/airtable';
import { BASE_ID, TEMPS, MOIS_OUVERTURE, envCourant } from '@/lib/config';

// Une fois Carnet branché sur Tps W, les mois saisis dans l'application
// (depuis MOIS_OUVERTURE) ne doivent plus être importés depuis Payfit :
// sinon chaque créneau existerait en double.
function importInterdit(table: string, corps: string): string | null {
  if (envCourant() !== 'production' || table !== TEMPS.production.table) return null;
  try {
    const recs = (JSON.parse(corps).records || []) as { fields?: Record<string, unknown> }[];
    const jour = TEMPS.production.f.jour;
    const n = recs.filter(r => String(r.fields?.[jour] ?? r.fields?.Jour ?? '') >= `${MOIS_OUVERTURE}-01`).length;
    return n ? `${n} saisie(s) à partir de novembre 2026 : ces mois sont saisis dans Carnet, l'import Payfit est désactivé pour eux.` : null;
  } catch { return null; }
}

async function relayer(req: Request) {
  return gerer(async () => {
    await exigerAdmin();
    const url = new URL(req.url);
    const chemin = url.searchParams.get('path');
    const [base, table, ...reste] = (chemin || '').split('/');
    // Seule la base de l'application est relayée, même si le token en ouvre d'autres.
    if (base !== BASE_ID || reste.length || !/^tbl[A-Za-z0-9]{14}$/.test(table || '')) return json({ erreur: 'Paramètre path invalide' }, 400);
    url.searchParams.delete('path');
    const init: RequestInit = { method: req.method };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await req.text();
      const refus = importInterdit(table, init.body as string);
      if (refus) return json({ erreur: refus, error: { message: refus } }, 409);
      init.headers = { 'Content-Type': 'application/json' };
    }
    const r = await brut(`${chemin}${url.search}`, init);
    return new NextResponse(await r.text(), {
      status: r.status,
      headers: { 'Content-Type': r.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' },
    });
  });
}
export { relayer as GET, relayer as POST, relayer as PATCH };

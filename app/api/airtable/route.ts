// Relais Airtable générique de l'ancien outil Admin (import Payfit, bilan).
// RÉSERVÉ AUX ADMINS : il donne accès à toute la base avec le token serveur.
import { NextResponse } from 'next/server';
import { exigerAdmin, gerer, json } from '@/lib/auth';
import { brut } from '@/lib/airtable';
import { BASE_ID } from '@/lib/config';

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

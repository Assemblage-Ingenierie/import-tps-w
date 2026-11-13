// Flux d'absences Payfit brut, pour l'ancien outil Admin. RÉSERVÉ AUX ADMINS :
// il contient les absences de toute l'entreprise.
import { NextResponse } from 'next/server';
import { exigerAdmin, gerer } from '@/lib/auth';
import { texteICS } from '@/lib/payfit';

export async function GET() {
  return gerer(async () => {
    await exigerAdmin();
    return new NextResponse(await texteICS(), {
      headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  });
}

import { exigerAdmin, gerer, json, ErreurHttp } from '@/lib/auth';
import { balanceVisibleUsers, definirBalanceVisible, facturationVisibleUsers, definirFacturationVisible } from '@/lib/mois';
import { envCourant } from '@/lib/config';
import { listeAdmins } from '@/lib/session';

export async function GET() {
  return gerer(async () => {
    await exigerAdmin();
    return json({ balanceVisibleUsers: (await balanceVisibleUsers()).actif, facturationVisibleUsers: (await facturationVisibleUsers()).actif, admins: listeAdmins(), env: envCourant() });
  });
}

export async function PATCH(req: Request) {
  return gerer(async () => {
    await exigerAdmin();
    const b = await req.json().catch(() => ({}));
    if (typeof b.balanceVisibleUsers === 'boolean') { await definirBalanceVisible(b.balanceVisibleUsers); return json({ balanceVisibleUsers: b.balanceVisibleUsers }); }
    if (typeof b.facturationVisibleUsers === 'boolean') { await definirFacturationVisible(b.facturationVisibleUsers); return json({ facturationVisibleUsers: b.facturationVisibleUsers }); }
    throw new ErreurHttp(400, 'Valeur invalide');
  });
}

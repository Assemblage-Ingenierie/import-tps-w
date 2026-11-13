// Bascule de vue d'un Admin : « user » (interface salarié) ou « admin ».
// Réservée aux comptes d'ADMIN_EMAILS (estAdmin), y compris en vue User.
import { exigerUtilisateur, gerer, json, ErreurHttp } from '@/lib/auth';
import { enteteCookieVue } from '@/lib/session';

export async function POST(req: Request) {
  return gerer(async () => {
    const u = await exigerUtilisateur();
    if (!u.estAdmin) throw new ErreurHttp(403, 'Réservé aux administrateurs');
    const b = await req.json().catch(() => ({}));
    if (b.vue !== 'user' && b.vue !== 'admin') throw new ErreurHttp(400, 'Vue invalide');
    const res = json({ vue: b.vue });
    res.headers.set('Set-Cookie', enteteCookieVue(b.vue));
    return res;
  });
}

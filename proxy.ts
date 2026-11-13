// Garde d'accès à l'échelle du déploiement (Next.js 16 : « proxy », ex-middleware).
//
// - Sans session valide : pages → /login, API → 401.
// - Pages et ressources Admin (/admin/*, /legacy/*, relais /api/airtable et
//   /api/calendar) : 403 pour un User.
// Les routes API revérifient de toute façon la session et le rôle : ce proxy
// est une première barrière, pas la seule.
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, COOKIE_VUE, lireJeton } from '@/lib/session';

const LIBRES = new Set(['/login', '/api/auth/callback', '/api/auth/logout', '/api/me', '/favicon.ico', '/logo-assemblage-noir.png']);
const ADMIN = [/^\/admin(\/|$)/, /^\/legacy\//, /^\/api\/admin\//, /^\/api\/airtable$/, /^\/api\/calendar$/];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (LIBRES.has(pathname)) return NextResponse.next();

  const u = await lireJeton(request.cookies.get(COOKIE)?.value, request.cookies.get(COOKIE_VUE)?.value).catch(() => null);
  const api = pathname.startsWith('/api/');
  if (!u) {
    if (api) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (ADMIN.some(re => re.test(pathname)) && u.role !== 'admin') {
    if (api) return NextResponse.json({ erreur: 'Réservé aux administrateurs' }, { status: 403 });
    return NextResponse.redirect(new URL('/saisie', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};

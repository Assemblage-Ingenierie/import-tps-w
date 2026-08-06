// Garde d'accès à l'échelle du déploiement.
//
// Le choix retenu est « toute l'application réservée à une liste d'adresses ».
// La page elle-même est donc protégée, pas seulement les endpoints de données :
// sans session valide, tout est redirigé vers /login.
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE = 'tpsw_session';

// Chemins joignables sans session : la page de connexion et ce qu'il lui faut
// pour fonctionner. Tout le reste est fermé.
const LIBRES = new Set(['/login', '/login.html', '/api/auth/callback', '/api/auth/logout', '/api/me', '/favicon.ico']);

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};

export default async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (LIBRES.has(pathname)) return NextResponse.next();

  const brut = req.cookies.get(COOKIE)?.value;
  let valide = false;
  const secret = process.env.SESSION_SECRET;

  if (brut && secret && secret.length >= 32) {
    try {
      const { payload } = await jwtVerify(brut, new TextEncoder().encode(secret), {
        issuer: 'tpsw', audience: 'tpsw',
      });
      const liste = String(process.env.ALLOWED_EMAILS || '')
        .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      // Liste vide = personne. Un déploiement mal configuré reste fermé.
      valide = liste.includes(String(payload.email || '').toLowerCase());
    } catch {
      valide = false;
    }
  }

  if (valide) return NextResponse.next();

  // Les appels de données répondent 401 : une redirection HTML casserait le
  // fetch côté client au lieu de lui donner une erreur exploitable.
  if (pathname.startsWith('/api/')) {
    return new NextResponse(JSON.stringify({ erreur: 'Non authentifié' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const dest = req.nextUrl.clone();
  dest.pathname = '/login';
  dest.search = '';
  return NextResponse.redirect(dest);
}

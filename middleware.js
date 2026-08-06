// Garde d'accès à l'échelle du déploiement.
//
// Ce n'est PAS un projet Next.js : pas de dépendance "next" dans package.json.
// Vercel propose aussi une Edge Middleware autonome ("Routing Middleware") pour
// les projets sans framework — elle utilise les API Web standard (Request /
// Response) plutôt que next/server, dont NextResponse ne fonctionnerait pas ici.
//
// Le choix retenu est « toute l'application réservée à une liste d'adresses ».
// La page elle-même est donc protégée, pas seulement les endpoints de données :
// sans session valide, tout est redirigé vers /login.
import { next } from '@vercel/functions';
import { jwtVerify } from 'jose';

const COOKIE = 'tpsw_session';

// Chemins joignables sans session : la page de connexion et ce qu'il lui faut
// pour fonctionner. Tout le reste est fermé.
const LIBRES = new Set(['/login', '/login.html', '/api/auth/callback', '/api/auth/logout', '/api/me', '/favicon.ico']);

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};

function lireCookie(request, nom) {
  const brut = request.headers.get('cookie') || '';
  for (const part of brut.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === nom) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (LIBRES.has(pathname)) return next();

  const brut = lireCookie(request, COOKIE);
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

  if (valide) return next();

  // Les appels de données répondent 401 : une redirection HTML casserait le
  // fetch côté client au lieu de lui donner une erreur exploitable.
  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ erreur: 'Non authentifié' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  return Response.redirect(new URL('/login', request.url), 302);
}

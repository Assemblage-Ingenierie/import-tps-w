// Relais générique vers l'API Airtable.
//
// Le token Airtable (AIRTABLE_TOKEN) reste côté serveur et n'atteint jamais le
// navigateur — même principe que /api/calendar pour l'URL Payfit. Contrairement
// au calendrier, l'API Airtable accepte déjà les appels cross-origin ; ce relais
// n'est donc pas motivé par le CORS mais par le partage d'un seul token entre
// tous les utilisateurs autorisés, au lieu d'exiger un PAT personnel par
// personne.
//
// Route fixe plutôt que segment dynamique ([...path].js) : cette convention de
// fichier est propre à certains frameworks et son comportement sur un projet
// sans framework n'est pas garanti (déjà eu un faux "next/server" fonctionne
// partout sur ce projet — on ne prend pas le même risque deux fois). Le chemin
// Airtable visé passe donc en paramètre de requête explicite : ?path=<baseId>/<tableId>
import { lireSession } from './_session.js';

export default async function handler(req, res) {
  const session = await lireSession(req).catch(() => null);
  if (!session) return res.status(401).json({ erreur: 'Non authentifié' });

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(503).json({ erreur: 'AIRTABLE_TOKEN non configuré' });

  const chemin = req.query.path;
  if (!chemin || Array.isArray(chemin)) {
    return res.status(400).json({ erreur: 'Paramètre path manquant ou invalide' });
  }

  // Retransmet la query string telle quelle, hormis notre propre paramètre "path".
  const entrante = new URL(req.url, 'http://x');
  entrante.searchParams.delete('path');
  const cible = `https://api.airtable.com/v0/${chemin}${entrante.search}`;

  const methode = req.method || 'GET';
  const entetes = { 'Authorization': 'Bearer ' + token };
  let corps;
  if (methode !== 'GET' && methode !== 'HEAD') {
    entetes['Content-Type'] = 'application/json';
    corps = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  }

  let reponse;
  try {
    reponse = await fetch(cible, {
      method: methode, headers: entetes, body: corps,
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    return res.status(502).json({ erreur: 'Airtable injoignable', detail: String(e.message || e) });
  }

  const texte = await reponse.text();
  res.status(reponse.status);
  res.setHeader('Content-Type', reponse.headers.get('content-type') || 'application/json');
  return res.send(texte);
}

// Proxy du calendrier d'absences Payfit.
//
// Raison d'être : l'API Payfit ne renvoie aucun en-tête Access-Control-Allow-Origin
// (vérifié — elle expose seulement Timing-Allow-Origin pour app.payfit.com). Un
// fetch navigateur est donc bloqué depuis n'importe quel domaine, quel que soit
// l'hébergement. Seul un appel serveur à serveur passe.
//
// Bénéfice secondaire, et non des moindres : l'URL Payfit reste une variable
// d'environnement. C'est un secret porteur — elle répond sans authentification,
// quiconque la détient lit les absences de toute l'entreprise — et le dépôt est
// public. Elle ne doit jamais atteindre le navigateur.
import { lireSession } from './_session.js';

// L'endpoint Payfit est limité (100 appels par fenêtre). Ce cache vit le temps
// d'une instance chaude ; il n'est pas partagé, ce qui suffit à absorber les
// rechargements successifs d'un même utilisateur.
let cache = null; // { ts, texte }
const TTL_MS = 5 * 60 * 1000;

export default async function handler(req, res) {
  const session = await lireSession(req).catch(() => null);
  if (!session) return res.status(401).json({ erreur: 'Non authentifié' });

  const url = process.env.PAYFIT_ICS_URL;
  if (!url) return res.status(503).json({ erreur: 'PAYFIT_ICS_URL non configuré' });

  if (cache && Date.now() - cache.ts < TTL_MS) {
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('X-Cache', 'hit');
    return res.status(200).send(cache.texte);
  }

  let reponse;
  try {
    reponse = await fetch(url, {
      headers: { 'Accept': 'text/calendar' },
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    // Si Payfit est injoignable mais qu'on a une version périmée, mieux vaut
    // la servir en le signalant que de laisser l'app sans calendrier.
    if (cache) {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('X-Cache', 'stale');
      return res.status(200).send(cache.texte);
    }
    return res.status(502).json({ erreur: 'Payfit injoignable', detail: String(e.message || e) });
  }

  if (!reponse.ok) {
    if (reponse.status === 429 && cache) {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('X-Cache', 'stale-429');
      return res.status(200).send(cache.texte);
    }
    return res.status(502).json({ erreur: `Payfit a répondu ${reponse.status}` });
  }

  const texte = await reponse.text();
  if (!texte.includes('BEGIN:VCALENDAR')) {
    return res.status(502).json({ erreur: 'Réponse Payfit inattendue (pas un calendrier iCalendar)' });
  }

  cache = { ts: Date.now(), texte };
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('X-Cache', 'miss');
  return res.status(200).send(texte);
}

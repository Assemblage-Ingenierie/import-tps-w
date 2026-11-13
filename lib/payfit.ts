// Absences Payfit, lues dans le flux iCalendar (PAYFIT_ICS_URL), en LECTURE
// SEULE. L'application ne crée, ne modifie et n'annule jamais d'absence.
//
// Le flux ne contient que des absences validées, sans motif. Payfit le met à
// jour « dans les 24 heures ». L'URL est un secret porteur : elle ne quitte
// jamais le serveur, et seuls les créneaux d'absence de la personne concernée
// sont renvoyés au navigateur.
import { addDays, normNom } from './dates';
import { memo } from './airtable';
import { ErreurHttp } from './erreurs';

export type IndexAbsences = Record<string, Set<string>>; // NOM NORMALISÉ → { "YYYY-MM-DD|AM" }

// Sémantique observée (vérifiée le 12/11/2026 sur 556 événements) :
//   DTSTART / DTEND dates pleines, DTEND EXCLUSIF.
//   Demi-journées uniquement dans DESCRIPTION :
//     · un jour   : "22 mars 2022 (matin)"
//     · une plage : "from: 5 déc. 2022 (matin)\nto: 7 déc. 2022 (matin)"
//   « from: X (après-midi) » → la matinée de X est travaillée.
//   « to:   Y (matin) »      → l'après-midi de Y est travaillé.
export function parseICS(brut: string): IndexAbsences {
  const t = brut.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const blocs = t.split('BEGIN:VEVENT').slice(1);
  const index: IndexAbsences = {};
  const moment = (s: string) => (/apr[eè]s-?midi/i.test(s) ? 'PM' : /matin/i.test(s) ? 'AM' : null);

  for (const b of blocs) {
    const g = (re: RegExp) => { const m = b.match(re); return m ? m[1].trim() : null; };
    const nom = g(/^SUMMARY:\s*(?:Absence\s*-\s*)?(.*)$/m);
    const debut = g(/^DTSTART[^:]*:(\d{8})/m);
    const fin = g(/^DTEND[^:]*:(\d{8})/m);
    if (!nom || !debut || !fin) continue;
    const desc = g(/^DESCRIPTION:([\s\S]*?)\\n\\nCet/m) || g(/^DESCRIPTION:(.*)$/m) || '';
    const iso = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    const d0 = iso(debut), dFin = iso(fin);

    let de: string | null = null, a: string | null = null;
    const plage = desc.match(/from:\s*(.*?)\\nto:\s*(.*)$/);
    if (plage) { de = moment(plage[1]); a = moment(plage[2]); }
    else { de = moment(desc); a = de; }

    const jours: string[] = [];
    for (let d = d0; d < dFin; d = addDays(d, 1)) jours.push(d);
    if (!jours.length) continue;

    const set = index[normNom(nom)] || (index[normNom(nom)] = new Set());
    for (const d of jours) { set.add(d + '|AM'); set.add(d + '|PM'); }
    if (de === 'PM') set.delete(jours[0] + '|AM');
    if (a === 'AM') set.delete(jours[jours.length - 1] + '|PM');
  }
  return index;
}

export async function chargerAbsences(): Promise<IndexAbsences | null> {
  const url = process.env.PAYFIT_ICS_URL;
  if (!url) return null;
  return memo('payfit:ics', 10 * 60 * 1000, async () => {
    const r = await fetch(url, { headers: { Accept: 'text/calendar' }, signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (!r.ok) throw new ErreurHttp(502, `Payfit a répondu ${r.status}`);
    const t = await r.text();
    if (!t.includes('BEGIN:VCALENDAR')) throw new ErreurHttp(502, 'Réponse Payfit inattendue');
    return parseICS(t);
  });
}

// Trouve les créneaux d'absence d'une personne. Rapprochement sur « Prénom NOM » ;
// à défaut de nom, sur le prénom seul s'il n'est porté que par une personne.
export function absencesDe(index: IndexAbsences, prenom: string, nom: string): Set<string> {
  const exact = index[normNom(`${prenom} ${nom}`)];
  if (exact) return exact;
  const p = normNom(prenom) + ' ';
  const candidats = Object.keys(index).filter(k => k.startsWith(p));
  return candidats.length === 1 ? index[candidats[0]] : new Set();
}

// Texte brut du flux, pour l'ancien outil Admin (/api/calendar).
export async function texteICS(): Promise<string> {
  const url = process.env.PAYFIT_ICS_URL;
  if (!url) throw new ErreurHttp(503, 'PAYFIT_ICS_URL non configuré');
  return memo('payfit:texte', 5 * 60 * 1000, async () => {
    const r = await fetch(url, { headers: { Accept: 'text/calendar' }, signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (!r.ok) throw new ErreurHttp(502, `Payfit a répondu ${r.status}`);
    const t = await r.text();
    if (!t.includes('BEGIN:VCALENDAR')) throw new ErreurHttp(502, 'Réponse Payfit inattendue');
    return t;
  });
}

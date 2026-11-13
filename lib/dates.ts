// Utilitaires de dates, partagés navigateur / serveur. Tout est en dates
// civiles « YYYY-MM-DD » manipulées en UTC : aucune dérive de fuseau.

export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
export const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dow(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDay();
}
export function isWeekend(iso: string): boolean {
  const d = dow(iso);
  return d === 0 || d === 6;
}
export function frDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
export function frDateLong(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${JOURS[dow(iso)]} ${Number(d)} ${MOIS_LONG[Number(m) - 1]} ${y}`;
}
export function frJourCourt(iso: string): string {
  return `${JOURS[dow(iso)].slice(0, 3)}. ${Number(iso.slice(8, 10))}`;
}
export function frMois(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MOIS_LONG[Number(m) - 1]} ${y}`;
}
export function moisDecale(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
export function joursDuMois(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) out.push(`${ym}-${String(d).padStart(2, '0')}`);
  return out;
}
export function estMoisValide(ym: unknown): ym is string {
  return typeof ym === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}
export function estDateValide(iso: unknown): iso is string {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && !isNaN(Date.parse(iso + 'T00:00:00Z'));
}

// Date du jour à Paris (à 0 h 30 à Paris, l'UTC est encore la veille).
export function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

// Numéro de semaine ISO 8601.
export function semaineIso(iso: string): number {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}
export function lundiDe(iso: string): string {
  return addDays(iso, -((dow(iso) + 6) % 7));
}

// Exercice fiscal 1er juillet → 30 juin : juillet 2026 relève de « 26/27 ».
export function exerciceDe(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return m >= 7
    ? `${String(y).slice(-2)}/${String(y + 1).slice(-2)}`
    : `${String(y - 1).slice(-2)}/${String(y).slice(-2)}`;
}

// ── Jours fériés français ────────────────────────────────────────────────
// Source reprise de l'application historique (calcul de Pâques — Meeus/Jones/
// Butcher). Le lundi de Pentecôte n'est PAS férié chez Assemblage : il est
// travaillé (décision du 12/11/2026).
function paques(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31);
  const da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mo - 1, da));
}
function feriesFR(y: number): Record<string, string> {
  const E = paques(y);
  const P = (n: number) => { const d = new Date(E); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  return {
    [`${y}-01-01`]: "Jour de l'An",
    [P(1)]: 'Lundi de Pâques',
    [`${y}-05-01`]: 'Fête du Travail',
    [`${y}-05-08`]: 'Victoire 1945',
    [P(39)]: 'Ascension',
    [`${y}-07-14`]: 'Fête nationale',
    [`${y}-08-15`]: 'Assomption',
    [`${y}-11-01`]: 'Toussaint',
    [`${y}-11-11`]: 'Armistice',
    [`${y}-12-25`]: 'Noël',
  };
}
const cacheFeries: Record<number, Record<string, string>> = {};
export function ferieNom(iso: string): string | null {
  const y = Number(iso.slice(0, 4));
  if (!cacheFeries[y]) cacheFeries[y] = feriesFR(y);
  return cacheFeries[y][iso] || null;
}
export function estOuvre(iso: string): boolean {
  return !isWeekend(iso) && !ferieNom(iso);
}

// Normalisation de nom : sans accents, majuscules, espaces compactés.
// « Absence - Aliénor FAUCHER » ↔ « ALIENOR FAUCHER ».
export function normNom(s: string): string {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

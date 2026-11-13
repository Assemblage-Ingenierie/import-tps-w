// Client Airtable minimal, côté serveur uniquement (AIRTABLE_TOKEN).
//
// Contraintes du plan Team : 5 requêtes/s par base et 100 000 appels API par
// mois. D'où : une file qui espace les appels d'une même instance (≥ 220 ms),
// une reprise sur 429, des lots de 10 en écriture, et un cache mémoire des
// référentiels (voir memo()).
import { BASE_ID } from './config';
import { ErreurHttp } from './erreurs';

export type Champs = Record<string, unknown>;
export interface Enregistrement { id: string; fields: Champs; createdTime?: string }

let dernierAppel = 0;
let file: Promise<unknown> = Promise.resolve();

function espacer<T>(fn: () => Promise<T>): Promise<T> {
  const suite = file.then(async () => {
    const attente = dernierAppel + 220 - Date.now();
    if (attente > 0) await new Promise(r => setTimeout(r, attente));
    dernierAppel = Date.now();
    return fn();
  });
  file = suite.catch(() => undefined);
  return suite;
}

async function appel(chemin: string, init: RequestInit = {}, essai = 0): Promise<any> {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new ErreurHttp(503, 'AIRTABLE_TOKEN non configuré');
  const r = await espacer(() => fetch(`https://api.airtable.com/v0/${BASE_ID}/${chemin}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  }));
  if (r.status === 429 && essai < 3) {
    await new Promise(res => setTimeout(res, 1500 * (essai + 1)));
    return appel(chemin, init, essai + 1);
  }
  const texte = await r.text();
  let data: any = {};
  try { data = texte ? JSON.parse(texte) : {}; } catch { data = { brut: texte }; }
  if (!r.ok) {
    const msg = data?.error?.message || data?.error?.type || `HTTP ${r.status}`;
    throw new ErreurHttp(502, `Airtable : ${msg}`);
  }
  return data;
}

export interface OptionsListe {
  fields?: string[];
  filterByFormula?: string;
  sort?: { field: string; direction?: 'asc' | 'desc' }[];
  max?: number;
}

export async function lister(table: string, o: OptionsListe = {}): Promise<Enregistrement[]> {
  const out: Enregistrement[] = [];
  let offset: string | undefined;
  do {
    const p = new URLSearchParams({ pageSize: '100', returnFieldsByFieldId: 'true' });
    (o.fields || []).forEach(f => p.append('fields[]', f));
    if (o.filterByFormula) p.set('filterByFormula', o.filterByFormula);
    (o.sort || []).forEach((s, i) => {
      p.set(`sort[${i}][field]`, s.field);
      p.set(`sort[${i}][direction]`, s.direction || 'asc');
    });
    if (offset) p.set('offset', offset);
    const d = await appel(`${table}?${p.toString()}`);
    out.push(...(d.records || []));
    offset = d.offset;
    if (o.max && out.length >= o.max) break;
  } while (offset);
  return out;
}

function lots<T>(t: T[], n = 10): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < t.length; i += n) out.push(t.slice(i, i + n));
  return out;
}

export async function creer(table: string, champs: Champs[]): Promise<Enregistrement[]> {
  const out: Enregistrement[] = [];
  for (const lot of lots(champs)) {
    const d = await appel(`${table}?returnFieldsByFieldId=true`, {
      method: 'POST',
      body: JSON.stringify({ records: lot.map(fields => ({ fields })), typecast: true, returnFieldsByFieldId: true }),
    });
    out.push(...d.records);
  }
  return out;
}

export async function modifier(table: string, maj: { id: string; fields: Champs }[]): Promise<Enregistrement[]> {
  const out: Enregistrement[] = [];
  for (const lot of lots(maj)) {
    const d = await appel(`${table}`, {
      method: 'PATCH',
      body: JSON.stringify({ records: lot, typecast: true, returnFieldsByFieldId: true }),
    });
    out.push(...d.records);
  }
  return out;
}

export async function supprimer(table: string, ids: string[]): Promise<void> {
  for (const lot of lots(ids)) {
    const p = new URLSearchParams();
    lot.forEach(id => p.append('records[]', id));
    await appel(`${table}?${p.toString()}`, { method: 'DELETE' });
  }
}

// Appel brut, réservé au relais Admin de l'ancien outil.
export async function brut(chemin: string, init: RequestInit): Promise<Response> {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new ErreurHttp(503, 'AIRTABLE_TOKEN non configuré');
  return espacer(() => fetch(`https://api.airtable.com/v0/${chemin}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  }));
}

// ── Helpers de lecture de valeurs ────────────────────────────────────────
// Un singleSelect revient en chaîne (API REST) ; un lookup en tableau.
export function texte(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.length ? texte(v[0]) : '';
  if (typeof v === 'object') return String((v as any).name ?? '');
  return String(v);
}
export function nombre(v: unknown): number | null {
  if (Array.isArray(v)) return v.length ? nombre(v[0]) : null;
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return isFinite(n) ? n : null;
}
export function liste(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(texte).filter(Boolean);
  const t = texte(v);
  return t ? [t] : [];
}
export function ids(v: unknown): string[] {
  return Array.isArray(v) ? v.map(x => (typeof x === 'string' ? x : (x as any)?.id)).filter(Boolean) : [];
}
// Échappement d'une chaîne dans une formule Airtable.
export function chaine(s: string): string {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

// ── Cache mémoire par instance ───────────────────────────────────────────
const caches = new Map<string, { t: number; v: Promise<unknown> }>();
export function memo<T>(cle: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const c = caches.get(cle);
  if (c && Date.now() - c.t < ttlMs) return c.v as Promise<T>;
  const v = fn();
  caches.set(cle, { t: Date.now(), v });
  v.catch(() => caches.delete(cle));
  return v;
}
export function oublier(prefixe: string): void {
  for (const k of caches.keys()) if (k.startsWith(prefixe)) caches.delete(k);
}

// Écritures sur la table Affaire depuis Carnet : se déclarer (ou ne plus être)
// Chef·fe de projet, et changer l'état interne d'une affaire.
// ATTENTION : c'est la vraie table Affaire (pas d'équivalent TEST).
import { AFFAIRE, NOMS } from './config';
import { lister, modifier, creer, texte, liste, chaine, oublier } from './airtable';
import * as O from './options-affaire';
import { normNom } from './dates';
import { ErreurHttp } from './erreurs';
import type { Utilisateur } from './session';
import type { Personne } from './referentiels';

// États proposés, dans l'ordre de vie d'une affaire (options de « Etat interne »).
export const ETATS = ['AO', 'Etude', 'Chantier', 'En Cours', 'Livré', 'Terminé', 'Annulé', 'Interrompu'];

// Lecture fraîche (sans cache) : on écrit à partir de la valeur actuelle.
async function lireAffaire(id: string) {
  if (!/^rec[A-Za-z0-9]{14}$/.test(id)) throw new ErreurHttp(400, 'Affaire invalide');
  const f = AFFAIRE.f;
  const r = (await lister(AFFAIRE.table, { fields: [f.cdp, f.manager, f.etat], filterByFormula: `RECORD_ID()=${chaine(id)}`, max: 1 }))[0];
  if (!r) throw new ErreurHttp(404, 'Affaire introuvable');
  return { cdp: liste(r.fields[f.cdp]), manager: texte(r.fields[f.manager]), etat: texte(r.fields[f.etat]) };
}

export function peutGerer(u: Utilisateur, p: Personne, a: { cdp: string[]; manager: string }): boolean {
  const n = normNom(p.prenom);
  return u.role === 'admin' || a.cdp.some(x => normNom(x) === n) || normNom(a.manager) === n;
}

// Ajoute ou retire le prénom de la personne dans le champ CDP (choix multiples) ;
// les autres Chef·fe·s de projet sont conservés.
export async function definirCdp(p: Personne, id: string, ajouter: boolean): Promise<void> {
  const a = await lireAffaire(id);
  const n = normNom(p.prenom);
  const deja = a.cdp.some(x => normNom(x) === n);
  if (ajouter === deja) return;
  const cdp = ajouter ? [...a.cdp, p.prenom] : a.cdp.filter(x => normNom(x) !== n);
  await modifier(AFFAIRE.table, [{ id, fields: { [AFFAIRE.f.cdp]: cdp } }]);
  oublier('ref:affaires');
}

// Change l'état interne : réservé au Chef·fe de projet, au Manager ou à un Admin.
export async function definirEtat(u: Utilisateur, p: Personne, id: string, etat: string): Promise<void> {
  if (!ETATS.includes(etat)) throw new ErreurHttp(400, 'État inconnu');
  const a = await lireAffaire(id);
  if (!peutGerer(u, p, a)) throw new ErreurHttp(403, 'Seul le Chef·fe de projet, le Manager ou un Admin peut changer l’état de cette affaire.');
  if (a.etat === etat) return;
  await modifier(AFFAIRE.table, [{ id, fields: { [AFFAIRE.f.etat]: etat } }]);
  oublier('ref:affaires');
}

// ── Création d'une affaire (fenêtre « Créer une affaire ») ─────────────────
// Ouverte à tout compte connecté. Écrit uniquement les champs de la fenêtre,
// par ID de champ ; les listes sont vérifiées contre les options Airtable.
const REC = /^rec[A-Za-z0-9]{14}$/;
function txt(v: unknown, max = 200): string { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function choix(v: unknown, options: string[], champ: string): string {
  const s = txt(v);
  if (s && !options.includes(s)) throw new ErreurHttp(400, `${champ} : valeur inconnue « ${s} »`);
  return s;
}
function choixMultiples(v: unknown, options: string[], champ: string): string[] {
  const l = Array.isArray(v) ? v.map(x => txt(x)).filter(Boolean) : [];
  for (const s of l) if (!options.includes(s)) throw new ErreurHttp(400, `${champ} : valeur inconnue « ${s} »`);
  return [...new Set(l)];
}
function liens(v: unknown): string[] {
  const l = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && REC.test(x)) : [];
  return [...new Set(l)].slice(0, 30);
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ErreurHttp(400, 'Montant ou surface invalide');
  return n;
}

export async function creerAffaire(u: Utilisateur, brut: unknown): Promise<{ id: string; code: string }> {
  const b = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
  const clef = txt(b.clef, 40).toUpperCase();
  const codeMoa = txt(b.codeMoa, 60).toUpperCase();
  const codeAdresse = txt(b.codeAdresse, 60).toUpperCase();
  const pole = choix(b.pole, O.POLES, 'Pôle');
  if (!clef || !codeMoa || !codeAdresse || !pole) throw new ErreurHttp(400, 'Clef, Code MOA/Pays, Code Adresse/Projet et Pôle sont obligatoires.');
  if (/[_s]/.test(clef + codeMoa + codeAdresse)) throw new ErreurHttp(400, 'Les codes ne doivent contenir ni espace ni « _ » (le « _ » sépare les codes dans le nom de l’affaire).');

  // Une même Clef ne doit exister qu'une fois.
  const deja = await lister(AFFAIRE.table, { fields: [AFFAIRE.f.clef], filterByFormula: `UPPER({${NOMS.affaireClef}})=${chaine(clef)}`, max: 1 });
  if (deja.length) throw new ErreurHttp(409, `La clef ${clef} existe déjà dans la table Affaire.`);

  const f = AFFAIRE.f;
  const c: Record<string, unknown> = {
    [f.clef]: clef, [f.codeMoa]: codeMoa, [f.codeAdresse]: codeAdresse, [f.pole]: pole,
  };
  const etat = choix(b.etat, O.ETATS_INTERNES, 'État interne'); if (etat) c[f.etat] = etat;
  const contrat = choix(b.contrat, O.CONTRATS, 'Contrat'); if (contrat) c[f.contrat] = contrat;
  const manager = choix(b.manager, O.MANAGERS, 'Manager'); if (manager) c[f.manager] = manager;
  const adresse = txt(b.adresse, 1000); if (adresse) c[f.adresse] = adresse;
  const multiples: [string, unknown, string[], string][] = [
    [f.cdp, b.cdp, O.CDPS, 'CDP'],
    [f.progPrincipaux, b.progPrincipaux, O.PROG_PRINCIPAUX, 'Programmes principaux'],
    [f.progSecondaires, b.progSecondaires, O.PROG_SECONDAIRES, 'Programmes secondaires'],
    [f.materiaux, b.materiaux, O.MATERIAUX, 'Matériaux'],
    [f.rehabNeuf, b.rehabNeuf, O.REHAB_NEUF, 'Rehab / Neuf'],
  ];
  for (const [id, v, opts, nom] of multiples) { const l = choixMultiples(v, opts, nom); if (l.length) c[id] = l; }
  for (const [id, v] of [[f.architecte, b.architecte], [f.moa, b.moa], [f.bet, b.bet], [f.entreprise, b.entreprise]] as const) {
    const l = liens(v); if (l.length) c[id] = l;
  }
  for (const [id, v] of [[f.surface, b.surface], [f.budgetHT, b.budgetHT], [f.marchePI, b.marchePI]] as const) {
    const n = num(v); if (n !== null) c[id] = n;
  }
  void u; // tout compte connecté peut créer une affaire
  const [r] = await creer(AFFAIRE.table, [c]);
  oublier('ref:affaires');
  return { id: r.id, code: [clef, codeMoa, codeAdresse].join('_') };
}

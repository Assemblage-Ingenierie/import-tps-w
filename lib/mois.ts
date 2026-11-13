// Le mois de saisie d'un collaborateur : assemblage des saisies, des absences
// Payfit et des jours fériés ; statut de validation ; commentaires ; règles.
import { VALIDATION, PARAM_BALANCE_USERS, NOMS, envCourant, LIBELLE_ENV } from './config';
import { lister, creer, modifier, supprimer, texte, chaine, memo, oublier } from './airtable';
import { joursDuMois, ferieNom, isWeekend, estOuvre, exerciceDe, aujourdhuiParis, estDateValide } from './dates';
import { chargerAbsences, absencesDe } from './payfit';
import { affairesParId, ficheDe, fiches, versLite, type Personne, type Affaire } from './referentiels';
import { saisiesDuMois, appliquer, type Saisie, type Cible, type Contexte } from './temps';
import { ErreurHttp } from './erreurs';
import type { Utilisateur } from './session';
import type { DonneesMois, Statut, Jour, Creneau_, Manquant, Conflit, Changement, Commentaire, Creneau } from './types';

const CRENEAUX: Creneau[] = ['AM', 'PM'];

export function cleMois(prenom: string, ym: string): string {
  return `${prenom} - ${exerciceDe(ym + '-01')}|${ym}|${LIBELLE_ENV[envCourant()]}`;
}

// ── Statut mensuel ───────────────────────────────────────────────────────
interface LigneStatut { id: string | null; statut: Statut; motif: string | null; soumisLe: string | null; decisionLe: string | null; fil: CommentaireStocke[]; off: string[] }

// Demi-journées ouvrées désactivées (non travaillées) : JSON ["AAAA-MM-JJ|AM", …].
function lireOff(v: unknown): string[] {
  try { const x = JSON.parse(texte(v) || '[]'); return Array.isArray(x) ? x.filter(s => typeof s === 'string') : []; } catch { return []; }
}

// Un commentaire tel que stocké dans le champ « Commentaires » (JSON) de la ligne du mois.
interface CommentaireStocke { id: string; texte: string; auteur: string; auteurNom: string; creeLe: string }
function lireFil(v: unknown): CommentaireStocke[] {
  try { const x = JSON.parse(texte(v) || '[]'); return Array.isArray(x) ? x : []; } catch { return []; }
}

export async function lireStatut(prenom: string, ym: string): Promise<LigneStatut> {
  const f = VALIDATION.f;
  const recs = await lister(VALIDATION.table, {
    fields: [f.statut, f.motif, f.soumisLe, f.decisionLe, f.commentaires, f.nonTravailles],
    filterByFormula: `{${NOMS.validationCle}}=${chaine(cleMois(prenom, ym))}`,
    max: 1,
  });
  const r = recs[0];
  if (!r) return { id: null, statut: 'A compléter', motif: null, soumisLe: null, decisionLe: null, fil: [], off: [] };
  return {
    id: r.id,
    statut: (texte(r.fields[f.statut]) || 'A compléter') as Statut,
    motif: texte(r.fields[f.motif]) || null,
    soumisLe: texte(r.fields[f.soumisLe]) || null,
    decisionLe: texte(r.fields[f.decisionLe]) || null,
    fil: lireFil(r.fields[f.commentaires]),
    off: lireOff(r.fields[f.nonTravailles]),
  };
}

export async function statutsDuMois(ym: string): Promise<Map<string, LigneStatut & { cle: string }>> {
  const f = VALIDATION.f;
  const recs = await lister(VALIDATION.table, {
    fields: [f.cle, f.statut, f.motif, f.soumisLe, f.decisionLe, f.commentaires, f.nonTravailles],
    filterByFormula: `AND({${NOMS.validationMois}}=${chaine(ym)}, {${NOMS.validationEnv}}=${chaine(LIBELLE_ENV[envCourant()])})`,
  });
  const m = new Map<string, LigneStatut & { cle: string }>();
  for (const r of recs) {
    const cle = texte(r.fields[f.cle]);
    m.set(cle, {
      cle, id: r.id,
      statut: (texte(r.fields[f.statut]) || 'A compléter') as Statut,
      motif: texte(r.fields[f.motif]) || null,
      soumisLe: texte(r.fields[f.soumisLe]) || null,
      decisionLe: texte(r.fields[f.decisionLe]) || null,
      fil: lireFil(r.fields[f.commentaires]),
      off: lireOff(r.fields[f.nonTravailles]),
    });
  }
  return m;
}

async function ecrireStatut(p: Personne, ym: string, actuel: LigneStatut, maj: Record<string, unknown>): Promise<void> {
  const f = VALIDATION.f;
  if (actuel.id) { await modifier(VALIDATION.table, [{ id: actuel.id, fields: maj }]); return; }
  const fiche = await ficheDe(p.prenom, exerciceDe(ym + '-01'));
  await creer(VALIDATION.table, [{
    [f.cle]: cleMois(p.prenom, ym),
    [f.email]: p.email || null,
    [f.mois]: ym,
    [f.env]: LIBELLE_ENV[envCourant()],
    [f.type]: 'Mois',
    ...(fiche ? { [f.collab]: [fiche.id] } : {}),
    ...maj,
  }]);
}

// ── Assemblage du mois ───────────────────────────────────────────────────
interface Etat {
  saisies: Saisie[];
  absences: Set<string> | null;
  affaires: Map<string, Affaire>;
}

async function charger(p: Personne, ym: string): Promise<Etat> {
  const [saisies, index, affaires] = await Promise.all([
    saisiesDuMois(p.prenom, ym),
    chargerAbsences().catch(() => null),
    affairesParId(),
  ]);
  return { saisies, absences: index ? absencesDe(index, p.prenom, p.nom) : null, affaires };
}

function analyser(ym: string, e: Etat, off: Set<string> = new Set()) {
  const jours: Jour[] = joursDuMois(ym).map(d => ({
    date: d,
    ferie: ferieNom(d),
    weekend: isWeekend(d),
    absence: { AM: !!e.absences?.has(`${d}|AM`), PM: !!e.absences?.has(`${d}|PM`) },
  }));
  const creneaux: Creneau_[] = [];
  const occupes = new Map<string, Saisie>();
  for (const s of e.saisies) {
    for (const c of s.creneau ? [s.creneau] : CRENEAUX) {
      const k = `${s.date}|${c}`;
      if (occupes.has(k)) continue; // doublon : le premier fait foi à l'affichage
      occupes.set(k, s);
      creneaux.push({ date: s.date, creneau: c, affaireId: s.affaireId, confirmClot: s.confirmClot, confirmNonOuvre: s.confirmNonOuvre, confirmAbsence: s.confirmAbsence });
    }
  }
  const manquants: Manquant[] = [];
  const conflits: Conflit[] = [];
  let attendus = 0, couverts = 0;
  for (const j of jours) {
    for (const c of CRENEAUX) {
      const s = occupes.get(`${j.date}|${c}`);
      const abs = j.absence[c];
      if (abs && s?.affaireId && !s.confirmAbsence) conflits.push({ date: j.date, creneau: c, affaireId: s.affaireId });
      if (!estOuvre(j.date)) continue;
      if (off.has(`${j.date}|${c}`) && !s?.affaireId) continue; // demi-journée désactivée
      attendus++;
      if (abs || (s && s.affaireId)) couverts++;
      else manquants.push({ date: j.date, creneau: c });
    }
  }
  return { jours, creneaux, manquants, conflits, attendus, couverts };
}

function verrou(u: Utilisateur, ym: string, statut: Statut): string | null {
  if (u.role === 'admin') return null;
  if (statut === 'Validée') return 'Mois validé : la saisie est verrouillée.';
  return null;
}

export async function donneesMois(u: Utilisateur, p: Personne, ym: string): Promise<DonneesMois> {
  const [e, st, fiche] = await Promise.all([charger(p, ym), lireStatut(p.prenom, ym), ficheDe(p.prenom, exerciceDe(ym + '-01'))]);
  const a = analyser(ym, e, new Set(st.off));
  const refs: Record<string, ReturnType<typeof versLite>> = {};
  for (const c of a.creneaux) {
    const af = c.affaireId ? e.affaires.get(c.affaireId) : null;
    if (af) refs[af.id] = versLite(af);
  }
  const raison = verrou(u, ym, st.statut);
  return {
    ym, env: envCourant(),
    collab: { cle: `${p.prenom} - ${exerciceDe(ym + '-01')}`, prenom: p.prenom, nom: p.nom, ficheId: fiche?.id || null },
    statut: st.statut, motifRefus: st.motif, soumisLe: st.soumisLe, decisionLe: st.decisionLe,
    jours: a.jours, creneaux: a.creneaux, affaires: refs,
    editable: !raison, raisonVerrou: raison,
    absencesDisponibles: e.absences !== null,
    completude: { attendus: a.attendus, couverts: a.couverts, manquants: a.manquants },
    conflits: a.conflits,
    vueAdmin: u.role === 'admin',
    // Déjà envoyé une fois, modifié depuis : à soumettre à nouveau.
    modifieApresEnvoi: st.statut === 'A compléter' && !!st.soumisLe,
    nonTravailles: st.off,
  };
}

// ── Écriture des créneaux ────────────────────────────────────────────────
export async function enregistrer(u: Utilisateur, p: Personne, ym: string, changements: Changement[]): Promise<DonneesMois> {
  const st = await lireStatut(p.prenom, ym);
  const raison = verrou(u, ym, st.statut);
  if (raison) throw new ErreurHttp(423, raison);
  const e = await charger(p, ym);
  const cibles: Cible[] = [];
  const off = new Set(st.off);
  for (const ch of changements) {
    if (!ch || !estDateValide(ch.date) || !joursDuMois(ym).includes(ch.date) || !CRENEAUX.includes(ch.creneau)) {
      throw new ErreurHttp(400, 'Créneau invalide');
    }
    const cleC = `${ch.date}|${ch.creneau}`;
    // Interrupteur : désactivée explicitement, ou réactivée (y compris en y saisissant du temps).
    if (ch.nonTravaille === true) off.add(cleC);
    if (ch.nonTravaille === false || ch.affaireId) off.delete(cleC);
    if (ch.affaireId === undefined) continue; // simple bascule, le temps saisi n'est pas touché
    const absent = !!e.absences?.has(cleC);
    if (absent && ch.affaireId && !ch.confirmAbsence) {
      throw new ErreurHttp(409, 'Confirmation requise : absence Payfit sur ce créneau', { confirmer: 'absence', date: ch.date, creneau: ch.creneau });
    }
    let affaire: Affaire | null = null;
    if (ch.affaireId) {
      affaire = e.affaires.get(ch.affaireId) || null;
      if (!affaire) throw new ErreurHttp(400, 'Affaire inconnue');
      if (affaire.clos && !ch.confirmClot) {
        throw new ErreurHttp(409, 'Confirmation requise : affaire clôturée', { confirmer: 'clos', affaireId: affaire.id });
      }
      if (!estOuvre(ch.date) && !ch.confirmNonOuvre) {
        throw new ErreurHttp(409, 'Confirmation requise : jour non ouvré', { confirmer: 'nonOuvre', date: ch.date });
      }
    }
    cibles.push({
      date: ch.date, creneau: ch.creneau, affaire,
      confirmClot: !!(affaire?.clos && ch.confirmClot),
      confirmNonOuvre: !!(affaire && !estOuvre(ch.date) && ch.confirmNonOuvre),
      confirmAbsence: !!(affaire && absent && ch.confirmAbsence),
    });
  }
  const cx: Contexte = { personne: p, fiche: await ficheDe(p.prenom, exerciceDe(ym + '-01')), auteur: u.email };
  if (cibles.length) await appliquer(cx, e.saisies, cibles);
  const maj: Record<string, unknown> = {};
  const offTrie = [...off].filter(x => x.slice(0, 7) === ym).sort();
  if (offTrie.join() !== [...st.off].sort().join()) maj[VALIDATION.f.nonTravailles] = offTrie.length ? JSON.stringify(offTrie) : null;
  if (u.role !== 'admin' && st.statut === 'En attente de validation') maj[VALIDATION.f.statut] = 'A compléter';
  if (Object.keys(maj).length) await ecrireStatut(p, ym, st, maj);
  return donneesMois(u, p, ym);
}

// ── Workflow ─────────────────────────────────────────────────────────────
export async function soumettre(u: Utilisateur, p: Personne, ym: string): Promise<DonneesMois> {
  const st = await lireStatut(p.prenom, ym);
  if (st.statut === 'En attente de validation' || st.statut === 'Validée') throw new ErreurHttp(409, `Mois déjà ${st.statut === 'Validée' ? 'validé' : 'soumis'}.`);
  if (ym > aujourdhuiParis().slice(0, 7)) throw new ErreurHttp(409, 'Impossible de soumettre un mois futur.');
  const d = await donneesMois(u, p, ym);
  if (d.completude.manquants.length) throw new ErreurHttp(409, `Mois incomplet : ${d.completude.manquants.length} créneau(x) à compléter.`, { manquants: d.completude.manquants });
  if (d.conflits.length) throw new ErreurHttp(409, `${d.conflits.length} créneau(x) saisi(s) sur une absence Payfit : confirme-les ou corrige-les avant de soumettre.`, { conflits: d.conflits });
  await ecrireStatut(p, ym, st, {
    [VALIDATION.f.statut]: 'En attente de validation',
    [VALIDATION.f.soumisLe]: new Date().toISOString(),
    [VALIDATION.f.motif]: null,
  });
  return donneesMois(u, p, ym);
}

export async function decider(u: Utilisateur, p: Personne, ym: string, decision: 'valider' | 'refuser' | 'rouvrir', motif?: string): Promise<DonneesMois> {
  if (u.role !== 'admin') throw new ErreurHttp(403, 'Réservé aux administrateurs');
  if (decision === 'valider' && ym > aujourdhuiParis().slice(0, 7)) throw new ErreurHttp(409, 'Impossible de valider un mois futur.');
  const st = await lireStatut(p.prenom, ym);
  const f = VALIDATION.f;
  if (decision === 'refuser') {
    if (!motif?.trim()) throw new ErreurHttp(400, 'Le motif du refus est obligatoire.');
    await ecrireStatut(p, ym, st, { [f.statut]: 'Refusée', [f.motif]: motif.trim(), [f.decisionLe]: new Date().toISOString(), [f.decisionPar]: u.email });
    await ajouterCommentaire(u, p, ym, `Mois refusé : ${motif.trim()}`);
  } else if (decision === 'valider') {
    await ecrireStatut(p, ym, st, { [f.statut]: 'Validée', [f.decisionLe]: new Date().toISOString(), [f.decisionPar]: u.email, [f.motif]: null });
  } else {
    await ecrireStatut(p, ym, st, { [f.statut]: 'A compléter', [f.decisionLe]: new Date().toISOString(), [f.decisionPar]: u.email });
  }
  return donneesMois(u, p, ym);
}

// ── Commentaires ─────────────────────────────────────────────────────────
// Rangés sur la ligne du mois (table AI Timesheet), dans le champ
// « Commentaires » : un tableau JSON { id, texte, auteur, auteurNom, creeLe }.
function versCommentaire(c: CommentaireStocke, mois: string, moi: string): Commentaire {
  const auteur = String(c.auteur || '').toLowerCase();
  return {
    id: c.id, texte: c.texte, auteur, auteurNom: c.auteurNom, creeLe: c.creeLe, mois,
    modifiable: !!moi && auteur === moi.toLowerCase(),
  };
}

export async function commentaires(p: Personne, ym: string, moi = ''): Promise<Commentaire[]> {
  const st = await lireStatut(p.prenom, ym);
  return st.fil.map(c => versCommentaire(c, ym, moi)).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
}

// Tous les commentaires d'une personne (tous mois, environnement courant), du plus récent au plus ancien.
export async function commentairesDe(p: Personne, moi = ''): Promise<Commentaire[]> {
  const f = VALIDATION.f;
  const debut = `${p.prenom} - `;
  const fin = `|${LIBELLE_ENV[envCourant()]}`;
  const recs = await lister(VALIDATION.table, {
    fields: [f.cle, f.commentaires],
    filterByFormula: `AND(LEFT({${NOMS.validationCle}}, ${debut.length})=${chaine(debut)}, RIGHT({${NOMS.validationCle}}, ${fin.length})=${chaine(fin)}, {${NOMS.validationCommentaires}}!='')`,
  });
  return recs
    .flatMap(r => { const mois = texte(r.fields[f.cle]).split('|')[1] || ''; return lireFil(r.fields[f.commentaires]).map(c => versCommentaire(c, mois, moi)); })
    .sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

// Commentaires d'un mois pour tout le monde (tableau de validation), par clé de mois.
export async function commentairesDuMois(ym: string): Promise<Map<string, Commentaire[]>> {
  const m = new Map<string, Commentaire[]>();
  for (const [cle, st] of await statutsDuMois(ym)) {
    if (st.fil.length) m.set(cle, st.fil.map(c => versCommentaire(c, ym, '')).sort((a, b) => a.creeLe.localeCompare(b.creeLe)));
  }
  return m;
}

export async function ajouterCommentaire(u: Utilisateur, p: Personne, ym: string, txt: string): Promise<void> {
  const t = String(txt || '').trim().slice(0, 4000);
  if (!t) throw new ErreurHttp(400, 'Commentaire vide');
  const st = await lireStatut(p.prenom, ym);
  const fil = [...st.fil, { id: crypto.randomUUID(), texte: t, auteur: u.email, auteurNom: u.nom || u.email, creeLe: new Date().toISOString() }];
  await ecrireStatut(p, ym, st, { [VALIDATION.f.commentaires]: JSON.stringify(fil) });
}

// Seul l'auteur d'un commentaire peut le modifier ou le supprimer.
async function ligneDuCommentaire(u: Utilisateur, id: string) {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) throw new ErreurHttp(400, 'Commentaire invalide');
  const f = VALIDATION.f;
  const r = (await lister(VALIDATION.table, {
    fields: [f.commentaires],
    filterByFormula: `FIND(${chaine(`"id":"${id}"`)}, {${NOMS.validationCommentaires}})`,
    max: 1,
  }))[0];
  const fil = r ? lireFil(r.fields[f.commentaires]) : [];
  const c = fil.find(x => x.id === id);
  if (!r || !c) throw new ErreurHttp(404, 'Commentaire introuvable');
  if (String(c.auteur).toLowerCase() !== u.email.toLowerCase()) throw new ErreurHttp(403, 'Vous ne pouvez modifier que vos propres commentaires.');
  return { ligne: r.id, fil };
}
export async function modifierCommentaire(u: Utilisateur, id: string, txt: string): Promise<void> {
  const t = String(txt || '').trim().slice(0, 4000);
  if (!t) throw new ErreurHttp(400, 'Commentaire vide');
  const { ligne, fil } = await ligneDuCommentaire(u, id);
  const maj = fil.map(c => (c.id === id ? { ...c, texte: t } : c));
  await modifier(VALIDATION.table, [{ id: ligne, fields: { [VALIDATION.f.commentaires]: JSON.stringify(maj) } }]);
}
export async function supprimerCommentaire(u: Utilisateur, id: string): Promise<void> {
  const { ligne, fil } = await ligneDuCommentaire(u, id);
  const maj = fil.filter(c => c.id !== id);
  await modifier(VALIDATION.table, [{ id: ligne, fields: { [VALIDATION.f.commentaires]: maj.length ? JSON.stringify(maj) : null } }]);
}

// ── Paramètres ───────────────────────────────────────────────────────────
// Lignes de type « Paramètre » de la table AI Timesheet, repérées par leur clé.
export function balanceVisibleUsers(): Promise<{ id: string | null; actif: boolean }> {
  return memo('param:balance', 60 * 1000, async () => {
    const f = VALIDATION.f;
    const r = (await lister(VALIDATION.table, { fields: [f.actif], filterByFormula: `{${NOMS.validationCle}}=${chaine(PARAM_BALANCE_USERS)}`, max: 1 }))[0];
    return { id: r?.id || null, actif: !!r?.fields[f.actif] };
  });
}
export async function definirBalanceVisible(actif: boolean): Promise<void> {
  const f = VALIDATION.f;
  const p = await balanceVisibleUsers();
  if (p.id) await modifier(VALIDATION.table, [{ id: p.id, fields: { [f.actif]: actif } }]);
  else await creer(VALIDATION.table, [{ [f.cle]: PARAM_BALANCE_USERS, [f.type]: 'Paramètre', [f.actif]: actif }]);
  oublier('param:');
}

// ── Validation en lot (Admin) ────────────────────────────────────────────
// Une lecture des statuts du mois, puis écritures groupées par lots de 10 :
// quelques appels Airtable au lieu de plusieurs par collaborateur.
export async function validerEnLot(u: Utilisateur, prenoms: string[], ym: string): Promise<{ valides: string[]; ignores: string[] }> {
  if (u.role !== 'admin') throw new ErreurHttp(403, 'Réservé aux administrateurs');
  if (ym > aujourdhuiParis().slice(0, 7)) throw new ErreurHttp(409, 'Impossible de valider un mois futur.');
  const f = VALIDATION.f;
  const [statuts, toutes] = await Promise.all([statutsDuMois(ym), fiches()]);
  const ex = exerciceDe(ym + '-01');
  const maintenant = new Date().toISOString();
  const decision = { [f.statut]: 'Validée', [f.decisionLe]: maintenant, [f.decisionPar]: u.email, [f.motif]: null };
  const aModifier: { id: string; fields: Record<string, unknown> }[] = [];
  const aCreer: Record<string, unknown>[] = [];
  const valides: string[] = [], ignores: string[] = [];
  for (const prenom of [...new Set(prenoms)]) {
    const siennes = toutes.filter(x => x.prenom === prenom);
    if (!siennes.length) { ignores.push(prenom); continue; }
    const st = statuts.get(cleMois(prenom, ym));
    if (st?.statut === 'Validée') { ignores.push(prenom); continue; }
    if (st?.id) aModifier.push({ id: st.id, fields: decision });
    else {
      const fiche = siennes.find(x => x.exercice === ex);
      aCreer.push({
        [f.cle]: cleMois(prenom, ym), [f.email]: siennes.find(x => x.email)?.email || null, [f.mois]: ym,
        [f.env]: LIBELLE_ENV[envCourant()], [f.type]: 'Mois', ...(fiche ? { [f.collab]: [fiche.id] } : {}), ...decision,
      });
    }
    valides.push(prenom);
  }
  if (aModifier.length) await modifier(VALIDATION.table, aModifier);
  if (aCreer.length) await creer(VALIDATION.table, aCreer);
  return { valides, ignores };
}

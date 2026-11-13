// Lecture / écriture des temps dans « Temps W » (ou « Temps W TEST »).
//
// Contrat de données (identique à l'export manuel Payfit, cf. docs §2.4) :
// une saisie = 0,5 j + créneau Matinée/Après-midi, liée à la fiche
// « Prénom - exercice » et à l'affaire. Les journées entières historiques
// (1 j sans créneau) sont lues comme deux demi-journées et scindées si l'une
// d'elles est modifiée.
import { TEMPS, NOMS, CRENEAU_LIBELLE, envCourant } from './config';
import { lister, creer, modifier, supprimer, texte, nombre, ids, chaine, type Champs } from './airtable';
import { exerciceDe } from './dates';
import type { Creneau } from './types';
import type { Fiche, Personne, Affaire } from './referentiels';

export interface Saisie {
  recordId: string;
  date: string;
  creneau: Creneau | null; // null = journée entière (historique)
  temps: number;
  affaireId: string | null;
  code: string;
  confirmClot: boolean;
  confirmNonOuvre: boolean;
  confirmAbsence: boolean;
  source: string;
  prenom: string;
}

function conf() { return TEMPS[envCourant()]; }

function versSaisie(r: { id: string; fields: Champs }): Saisie {
  const f = conf().f;
  const c = texte(r.fields[f.creneau]);
  return {
    recordId: r.id,
    date: texte(r.fields[f.jour]).slice(0, 10),
    creneau: c === CRENEAU_LIBELLE.AM ? 'AM' : c === CRENEAU_LIBELLE.PM ? 'PM' : null,
    temps: nombre(r.fields[f.temps]) ?? 0,
    affaireId: ids(r.fields[f.linkAffaire])[0] || null,
    code: texte(r.fields[f.code]),
    confirmClot: f.confClot ? !!r.fields[f.confClot] : false,
    confirmNonOuvre: f.confNonOuvre ? !!r.fields[f.confNonOuvre] : false,
    confirmAbsence: f.confAbsence ? !!r.fields[f.confAbsence] : false,
    source: f.source ? texte(r.fields[f.source]) : '',
    prenom: texte(r.fields[f.prenom]),
  };
}

function champsLecture(): string[] {
  const f = conf().f;
  return [f.jour, f.creneau, f.temps, f.linkAffaire, f.code, f.prenom, f.confClot, f.confNonOuvre, f.confAbsence, f.source]
    .filter((x): x is string => !!x);
}

// Saisies d'une personne sur un mois.
export async function saisiesDuMois(prenom: string, ym: string): Promise<Saisie[]> {
  const cle = `${prenom} - ${exerciceDe(ym + '-01')}`;
  const recs = await lister(conf().table, {
    fields: champsLecture(),
    filterByFormula: `AND({${NOMS.tempsCleCollab}}=${chaine(cle)}, DATETIME_FORMAT({${NOMS.tempsJour}},'YYYY-MM')=${chaine(ym)})`,
  });
  return recs.map(versSaisie).filter(s => s.date);
}

// Saisies de tout le monde sur un mois (vue Admin).
export async function saisiesDeTousLeMois(ym: string): Promise<Saisie[]> {
  const recs = await lister(conf().table, {
    fields: champsLecture(),
    filterByFormula: `DATETIME_FORMAT({${NOMS.tempsJour}},'YYYY-MM')=${chaine(ym)}`,
  });
  return recs.map(versSaisie).filter(s => s.date);
}

// Saisies d'un exercice (jours par affaire).
export async function saisiesExercice(exercice: string, prenom?: string): Promise<Saisie[]> {
  const f = conf().f;
  const filtre = prenom
    ? `{${NOMS.tempsCleCollab}}=${chaine(`${prenom} - ${exercice}`)}`
    : `{${NOMS.tempsExercice}}=${chaine(exercice)}`;
  const recs = await lister(conf().table, { fields: [f.jour, f.creneau, f.temps, f.linkAffaire, f.code, f.prenom], filterByFormula: filtre });
  return recs.map(versSaisie);
}

// ── Écriture ─────────────────────────────────────────────────────────────
export interface Cible {
  date: string;
  creneau: Creneau;
  affaire: Affaire | null; // null = vider le créneau
  confirmClot: boolean;
  confirmNonOuvre: boolean;
  confirmAbsence?: boolean;
}

export interface Contexte {
  personne: Personne;
  fiche: Fiche | null;
  auteur: string; // email de qui écrit
}

function champsEcriture(cx: Contexte, date: string, creneau: Creneau, a: Affaire, confirmClot: boolean, confirmNonOuvre: boolean, confirmAbsence = false): Champs {
  const f = conf().f;
  const ch: Champs = {
    [f.prenom]: cx.personne.prenom,
    [f.jour]: date,
    [f.code]: a.code,
    [f.nomProjet]: a.nom,
    [f.temps]: 0.5,
    [f.unite]: 'jours',
    [f.creneau]: CRENEAU_LIBELLE[creneau],
    [f.linkAffaire]: [a.id],
  };
  if (cx.personne.nom) ch[f.nom] = cx.personne.nom.toUpperCase();
  if (cx.personne.idPayfit) ch[f.idCollab] = cx.personne.idPayfit;
  if (cx.fiche) ch[f.linkCollab] = [cx.fiche.id];
  if (f.confClot) ch[f.confClot] = confirmClot;
  if (f.confNonOuvre) ch[f.confNonOuvre] = confirmNonOuvre;
  if (f.confAbsence) ch[f.confAbsence] = confirmAbsence;
  if (f.confLe) ch[f.confLe] = confirmClot || confirmNonOuvre || confirmAbsence ? new Date().toISOString() : null;
  if (f.source) ch[f.source] = 'Application';
  if (f.saisiPar) ch[f.saisiPar] = cx.auteur;
  return ch;
}

// Applique des cibles de créneaux à l'existant : crée, met à jour, supprime.
// `existantes` doit être fraîchement lu (pas de cache).
export async function appliquer(cx: Contexte, existantes: Saisie[], cibles: Cible[]): Promise<void> {
  const t = conf().table;
  const f = conf().f;
  // Index créneau → saisies. Une journée entière occupe AM et PM.
  const parCreneau = new Map<string, Saisie[]>();
  const ajouter = (k: string, s: Saisie) => { const l = parCreneau.get(k) || []; l.push(s); parCreneau.set(k, l); };
  for (const s of existantes) {
    if (s.creneau) ajouter(`${s.date}|${s.creneau}`, s);
    else { ajouter(`${s.date}|AM`, s); ajouter(`${s.date}|PM`, s); }
  }

  const aCreer: Champs[] = [];
  const aModifier = new Map<string, Champs>();
  const aSupprimer = new Set<string>();
  const journeesScindees = new Set<string>();

  // Une journée entière touchée est scindée : l'enregistrement devient la
  // matinée, l'après-midi est recréé avec l'affaire d'origine — puis les
  // cibles s'appliquent normalement.
  const touchees = new Set(cibles.map(c => `${c.date}|${c.creneau}`));
  for (const s of existantes) {
    if (s.creneau || journeesScindees.has(s.recordId)) continue;
    if (!touchees.has(`${s.date}|AM`) && !touchees.has(`${s.date}|PM`)) continue;
    journeesScindees.add(s.recordId);
    aModifier.set(s.recordId, { [f.temps]: 0.5, [f.creneau]: CRENEAU_LIBELLE.AM });
    parCreneau.set(`${s.date}|AM`, [{ ...s, creneau: 'AM', temps: 0.5 }]);
    parCreneau.set(`${s.date}|PM`, [{ ...s, recordId: '', creneau: 'PM', temps: 0.5 }]); // '' = à créer si conservé
  }

  for (const c of cibles) {
    const k = `${c.date}|${c.creneau}`;
    const actuelles = parCreneau.get(k) || [];
    const [garde, ...doublons] = actuelles;
    doublons.forEach(d => d.recordId && aSupprimer.add(d.recordId));
    if (!c.affaire) {
      if (garde?.recordId) { aSupprimer.add(garde.recordId); aModifier.delete(garde.recordId); }
      parCreneau.set(k, []);
      continue;
    }
    const champs = champsEcriture(cx, c.date, c.creneau, c.affaire, c.confirmClot, c.confirmNonOuvre, c.confirmAbsence);
    if (garde?.recordId) aModifier.set(garde.recordId, { ...(aModifier.get(garde.recordId) || {}), ...champs });
    else aCreer.push(champs);
    parCreneau.set(k, [{ ...(garde || ({} as Saisie)), affaireId: c.affaire.id }]);
  }

  // Après-midi des journées scindées non touché par une cible : recréé à l'identique.
  for (const s of existantes) {
    if (!journeesScindees.has(s.recordId)) continue;
    const pm = parCreneau.get(`${s.date}|PM`)?.[0];
    if (pm && pm.recordId === '' && !touchees.has(`${s.date}|PM`)) {
      const ch: Champs = {
        [f.prenom]: s.prenom || cx.personne.prenom, [f.jour]: s.date, [f.code]: s.code,
        [f.temps]: 0.5, [f.unite]: 'jours', [f.creneau]: CRENEAU_LIBELLE.PM,
      };
      if (s.affaireId) ch[f.linkAffaire] = [s.affaireId];
      if (cx.fiche) ch[f.linkCollab] = [cx.fiche.id];
      if (cx.personne.nom) ch[f.nom] = cx.personne.nom.toUpperCase();
      if (f.source) ch[f.source] = 'Application';
      if (f.saisiPar) ch[f.saisiPar] = cx.auteur;
      aCreer.push(ch);
    }
  }

  for (const id of aSupprimer) aModifier.delete(id);
  if (aSupprimer.size) await supprimer(t, [...aSupprimer]);
  if (aModifier.size) await modifier(t, [...aModifier].map(([id, fields]) => ({ id, fields })));
  if (aCreer.length) await creer(t, aCreer);
}

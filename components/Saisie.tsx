'use client';
// « Mon suivi de temps de travail » — vues Liste et Calendrier, sélection
// multiple, copie de semaine, confirmations, soumission du mois, commentaires.
// Utilisé aussi par l'Admin pour relire, corriger et valider le mois d'un
// collaborateur (prop `prenom`).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AffaireLite, Changement, Creneau, DonneesMois, Jour, Commentaire } from '@/lib/types';
import {
  aujourdhuiParis, moisDecale, frMois, frDateLong, semaineIso, lundiDe, addDays, estOuvre, dow,
} from '@/lib/dates';
import SelecteurAffaire from './SelecteurAffaire';
import { couleurAffaire } from './couleurs';

const CRENEAUX: Creneau[] = ['AM', 'PM'];
const LIB: Record<Creneau, string> = { AM: 'Matinée', PM: 'Après-midi' };
const k = (d: string, c: Creneau) => `${d}|${c}`;
const nb = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

type Vue = 'liste' | 'calendrier';
interface Confirmation { clos: AffaireLite[]; nonOuvres: string[]; changements: Changement[] }

async function appel<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.erreur || `Erreur ${r.status}`), { data: d, status: r.status });
  return d as T;
}

function lireRecentes(): string[] {
  try { return JSON.parse(localStorage.getItem('tpsw_recentes') || '[]'); } catch { return []; }
}
function noterRecente(id: string) {
  try { localStorage.setItem('tpsw_recentes', JSON.stringify([id, ...lireRecentes().filter(x => x !== id)].slice(0, 6))); } catch { /* stockage indisponible */ }
}

export default function Saisie({ prenom }: { prenom?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const ym = params.get('ym') && /^\d{4}-\d{2}$/.test(params.get('ym')!) ? params.get('ym')! : aujourdhuiParis().slice(0, 7);
  const vue: Vue = params.get('vue') === 'calendrier' ? 'calendrier' : 'liste';

  const [data, setData] = useState<DonneesMois | null>(null);
  const [affaires, setAffaires] = useState<AffaireLite[]>([]);
  const [mesIds, setMesIds] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selecteur, setSelecteur] = useState<string[] | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [voirWeekends, setVoirWeekends] = useState(false);
  const [panneau, setPanneau] = useState<'commentaires' | 'manquants' | 'refus' | null>(null);
  const [recentes, setRecentes] = useState<string[]>([]);

  const qPrenom = prenom ? `&prenom=${encodeURIComponent(prenom)}` : '';
  const aller = (o: { ym?: string; vue?: Vue }) => {
    const p = new URLSearchParams(params.toString());
    if (o.ym) p.set('ym', o.ym);
    if (o.vue) p.set('vue', o.vue);
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  const charger = useCallback(async () => {
    setChargement(true); setErreur(null); setSelection(new Set());
    try { setData(await appel<DonneesMois>(`/api/mois?ym=${ym}${qPrenom}`)); }
    catch (e) { setErreur((e as Error).message); setData(null); }
    finally { setChargement(false); }
  }, [ym, qPrenom]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    setRecentes(lireRecentes());
    appel<{ affaires: AffaireLite[]; mes: AffaireLite[] }>(`/api/affaires?mes=1${qPrenom}`)
      .then(d => { setAffaires(d.affaires); setMesIds(new Set(d.mes.map(a => a.id))); })
      .catch(() => appel<{ affaires: AffaireLite[] }>('/api/affaires').then(d => setAffaires(d.affaires)).catch(() => undefined));
  }, [qPrenom]);

  const affParId = useMemo(() => {
    const m = new Map<string, AffaireLite>(affaires.map(a => [a.id, a]));
    if (data) for (const a of Object.values(data.affaires)) if (!m.has(a.id)) m.set(a.id, a);
    return m;
  }, [affaires, data]);

  const creneaux = useMemo(() => new Map((data?.creneaux || []).map(c => [k(c.date, c.creneau), c])), [data]);
  const jourParDate = useMemo(() => new Map((data?.jours || []).map(j => [j.date, j])), [data]);
  const conflits = useMemo(() => new Set((data?.conflits || []).map(c => k(c.date, c.creneau))), [data]);
  const manquants = useMemo(() => new Set((data?.completude.manquants || []).map(m => k(m.date, m.creneau))), [data]);

  const verrouille = (d: string, c: Creneau) => {
    if (!data?.editable) return true;
    const j = jourParDate.get(d);
    return !!j?.absence[c] && !data.vueAdmin;
  };

  // ── Enregistrement avec confirmations ──────────────────────────────────
  async function envoyer(changements: Changement[]) {
    if (!changements.length) return;
    setEnCours(true); setErreur(null);
    try {
      const d = await appel<DonneesMois>('/api/mois', { method: 'PUT', body: JSON.stringify({ ym, prenom, changements }) });
      setData(d); setSelection(new Set());
    } catch (e) {
      setErreur((e as Error).message);
    } finally { setEnCours(false); }
  }

  function preparer(cles: string[], a: AffaireLite | null) {
    const changements: Changement[] = cles.map(x => {
      const [date, c] = x.split('|') as [string, Creneau];
      return { date, creneau: c, affaireId: a?.id ?? null };
    });
    proposer(changements);
  }

  function proposer(changements: Changement[]) {
    const clos = new Map<string, AffaireLite>();
    const nonOuvres = new Set<string>();
    for (const ch of changements) {
      if (!ch.affaireId) continue;
      const a = affParId.get(ch.affaireId);
      const deja = creneaux.get(k(ch.date, ch.creneau));
      if (a?.clos && !(deja?.affaireId === a.id && deja.confirmClot)) clos.set(a.id, a);
      if (!estOuvre(ch.date) && !(deja?.affaireId && deja.confirmNonOuvre)) nonOuvres.add(ch.date);
    }
    if (clos.size || nonOuvres.size) setConfirmation({ clos: [...clos.values()], nonOuvres: [...nonOuvres].sort(), changements });
    else envoyer(changements.map(ch => ({ ...ch, confirmClot: true, confirmNonOuvre: true })));
  }

  function choisir(a: AffaireLite | null) {
    const cles = selecteur || [];
    setSelecteur(null);
    if (a) { noterRecente(a.id); setRecentes(lireRecentes()); }
    preparer(cles, a);
  }

  // Copie de la semaine précédente (jours ouvrés, sans toucher aux créneaux verrouillés).
  async function copierSemainePrecedente(lundi: string) {
    if (!data) return;
    const precedent = addDays(lundi, -7);
    let source = creneaux;
    if (precedent.slice(0, 7) !== ym || addDays(precedent, 4).slice(0, 7) !== ym) {
      try {
        const autre = await appel<DonneesMois>(`/api/mois?ym=${precedent.slice(0, 7)}${qPrenom}`);
        source = new Map([...creneaux, ...autre.creneaux.map(c => [k(c.date, c.creneau), c] as const)]);
      } catch (e) { setErreur((e as Error).message); return; }
    }
    const changements: Changement[] = [];
    for (let i = 0; i < 5; i++) {
      const d = addDays(lundi, i);
      if (d.slice(0, 7) !== ym || !estOuvre(d)) continue;
      for (const c of CRENEAUX) {
        if (verrouille(d, c) || jourParDate.get(d)?.absence[c]) continue;
        const src = source.get(k(addDays(precedent, i), c));
        if (!src?.affaireId) continue;
        if (creneaux.get(k(d, c))?.affaireId === src.affaireId) continue;
        changements.push({ date: d, creneau: c, affaireId: src.affaireId });
      }
    }
    if (!changements.length) { setInfo('Rien à copier : la semaine précédente est vide ou identique.'); return; }
    proposer(changements);
  }

  function remplirSemaine(lundi: string) {
    const cles: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = addDays(lundi, i);
      if (d.slice(0, 7) !== ym || !estOuvre(d)) continue;
      for (const c of CRENEAUX) if (!verrouille(d, c) && !jourParDate.get(d)?.absence[c] && !creneaux.get(k(d, c))?.affaireId) cles.push(k(d, c));
    }
    if (!cles.length) { setInfo('Tous les créneaux ouvrés de cette semaine sont déjà remplis.'); return; }
    setSelecteur(cles);
  }

  function basculer(cle: string) {
    setSelection(s => { const n = new Set(s); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  }

  async function workflow(action: 'soumettre' | 'valider' | 'refuser' | 'rouvrir', motif?: string) {
    setEnCours(true); setErreur(null);
    try {
      const d = await appel<DonneesMois>('/api/mois', { method: 'POST', body: JSON.stringify({ ym, prenom, action, motif }) });
      setData(d); setPanneau(null);
      setInfo(action === 'soumettre' ? 'Mois soumis pour validation.' : action === 'valider' ? 'Mois validé.' : action === 'refuser' ? 'Mois refusé : le collaborateur peut corriger et soumettre de nouveau.' : 'Mois rouvert.');
    } catch (e) {
      const err = e as Error & { data?: { manquants?: unknown[] } };
      if (err.data?.manquants) setPanneau('manquants');
      setErreur(err.message);
    } finally { setEnCours(false); }
  }

  // Raccourcis clavier : ←/→ change de mois (hors champ de saisie et hors fenêtre).
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (selecteur || confirmation || panneau) return;
      const t = e.target as HTMLElement;
      if (t && ['INPUT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.key === 'ArrowLeft') aller({ ym: moisDecale(ym, -1) });
      if (e.key === 'ArrowRight') aller({ ym: moisDecale(ym, 1) });
      if (e.key === 'Enter' && selection.size) setSelecteur([...selection]);
      if (e.key === 'Escape') setSelection(new Set());
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  });

  // ── Rendu ──────────────────────────────────────────────────────────────
  const total = data ? data.creneaux.filter(c => c.affaireId).length / 2 : 0;
  const semaines = useMemo(() => {
    if (!data) return [] as { lundi: string; jours: Jour[] }[];
    const m = new Map<string, Jour[]>();
    for (const j of data.jours) { const l = lundiDe(j.date); m.set(l, [...(m.get(l) || []), j]); }
    return [...m.entries()].map(([lundi, jours]) => ({ lundi, jours }));
  }, [data]);

  const pilule = (id: string | null, cle: string) => {
    const a = id ? affParId.get(id) : null;
    return a
      ? <span className="pilule" title={`${a.code} — ${a.nom}`}><span className="pastille" style={{ background: couleurAffaire(a) }} />{a.code} <span className="pilule-nom">({a.nom})</span></span>
      : <span className="pilule vide">{manquants.has(cle) ? 'À compléter' : 'Projet'}</span>;
  };

  const mentions = (d: string, c: Creneau) => {
    const s = creneaux.get(k(d, c));
    const a = s?.affaireId ? affParId.get(s.affaireId) : null;
    const out: React.ReactNode[] = [];
    if (conflits.has(k(d, c))) out.push(<div key="abs" className="mention err">Temps saisi pendant une absence Payfit — à corriger</div>);
    if (a?.clos) out.push(<div key="clos" className="mention warn">{s?.confirmClot ? 'Affaire clôturée mais saisie maintenue par le collaborateur' : `Affaire clôturée (${a.etat})`}</div>);
    if (s?.affaireId && s.confirmNonOuvre && !estOuvre(d)) out.push(<div key="no" className="mention info">Saisie un jour non ouvré, confirmée par le collaborateur</div>);
    return out;
  };

  const creneauListe = (j: Jour, c: Creneau) => {
    const cle = k(j.date, c);
    const s = creneaux.get(cle);
    const abs = j.absence[c];
    const lock = verrouille(j.date, c);
    if (abs && !s?.affaireId) {
      return (
        <div className="creneau verrou" key={c}>
          <span className="lib">{LIB[c]}</span>
          <span className="pilule absence">Absence (Payfit)</span>
        </div>
      );
    }
    return (
      <div className={`creneau ${selection.has(cle) ? 'sel' : ''} ${manquants.has(cle) ? 'manquant' : ''}`} key={c} id={`c-${j.date}-${c}`}>
        {!lock && <input type="checkbox" aria-label={`Sélectionner ${LIB[c]} du ${frDateLong(j.date)}`} checked={selection.has(cle)} onChange={() => basculer(cle)} />}
        <span className="lib">{LIB[c]}</span>
        <button className="choix" disabled={lock || enCours} onClick={() => setSelecteur(selection.has(cle) && selection.size > 1 ? [...selection] : [cle])}>
          {pilule(s?.affaireId || null, cle)}<span className="chevron">▾</span>
        </button>
        {!lock && s?.affaireId && <button className="vider" title="Vider le créneau" disabled={enCours} onClick={() => preparer([cle], null)}>×</button>}
        <div className="mentions">{mentions(j.date, c)}</div>
      </div>
    );
  };

  const vueListe = () => semaines.map(({ lundi, jours }) => {
    const totalSem = jours.reduce((t, j) => t + CRENEAUX.filter(c => { const s = creneaux.get(k(j.date, c)); return !!s?.affaireId; }).length * 0.5, 0);
    return (
      <section className="semaine" key={lundi}>
        <div className="semaine-tete">
          <span className="sem">S{semaineIso(lundi)}</span><span className="sem-total">{nb(totalSem)} j</span>
          <span className="espace" />
          {data?.editable && <>
            <button className="lien" onClick={() => copierSemainePrecedente(lundi)} disabled={enCours}>Copier la semaine précédente</button>
            <button className="lien" onClick={() => remplirSemaine(lundi)} disabled={enCours}>Remplir les créneaux vides…</button>
          </>}
        </div>
        {jours.map(j => {
          const nonOuvre = !estOuvre(j.date);
          const aDesSaisies = CRENEAUX.some(c => creneaux.get(k(j.date, c))?.affaireId);
          if (j.weekend && !voirWeekends && !aDesSaisies) return null;
          const totalJ = CRENEAUX.filter(c => { const s = creneaux.get(k(j.date, c)); return !!s?.affaireId; }).length * 0.5;
          return (
            <div className={`jour ${nonOuvre ? 'non-ouvre' : ''} ${j.date === aujourdhuiParis() ? 'auj' : ''}`} key={j.date} id={`j-${j.date}`}>
              <div className="jour-date">
                <span className="jour-nom">{frDateLong(j.date).split(' ')[0]}</span>
                <span className="jour-num">{frDateLong(j.date).split(' ').slice(1, 3).join(' ')}</span>
                {j.ferie && <span className="tag ferie">{j.ferie}</span>}
              </div>
              <div className="jour-creneaux">{CRENEAUX.map(c => creneauListe(j, c))}</div>
              <div className="jour-total"><small>Total</small>{nb(totalJ)} j</div>
            </div>
          );
        })}
      </section>
    );
  });

  const vueCalendrier = () => {
    if (!data) return null;
    const premier = data.jours[0].date;
    const vides = (dow(premier) + 6) % 7;
    return (
      <div className="calendrier">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(x => <div key={x} className="cal-entete">{x}</div>)}
        {Array.from({ length: vides }, (_, i) => <div key={`v${i}`} className="cal-case vide" />)}
        {data.jours.map(j => (
          <div key={j.date} className={`cal-case ${!estOuvre(j.date) ? 'non-ouvre' : ''} ${j.date === aujourdhuiParis() ? 'auj' : ''}`}>
            <div className="cal-num">{Number(j.date.slice(8))}{j.ferie && <span className="tag ferie" title={j.ferie}>Férié</span>}</div>
            {CRENEAUX.map(c => {
              const cle = k(j.date, c);
              const s = creneaux.get(cle);
              const a = s?.affaireId ? affParId.get(s.affaireId) : null;
              const abs = j.absence[c] && !s?.affaireId;
              const lock = verrouille(j.date, c) || abs;
              return (
                <button key={c} disabled={lock || enCours}
                  className={`cal-demi ${abs ? 'absence' : ''} ${selection.has(cle) ? 'sel' : ''} ${manquants.has(cle) ? 'manquant' : ''} ${conflits.has(cle) ? 'conflit' : ''}`}
                  style={a && !abs ? { background: couleurAffaire(a), color: '#fff' } : undefined}
                  title={`${LIB[c]} — ${abs ? 'Absence (Payfit)' : a ? `${a.code} ${a.nom}` : 'vide'}${s?.confirmClot ? ' — affaire clôturée, saisie maintenue' : ''}`}
                  onClick={e => (e.shiftKey || e.ctrlKey || e.metaKey || selection.size ? basculer(cle) : setSelecteur([cle]))}>
                  {abs ? 'Absence' : a ? a.code : c === 'AM' ? 'matin' : 'après-midi'}{s?.confirmClot && ' ⚠'}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const statutClasse = data ? { 'A compléter': 'brouillon', 'En attente de validation': 'attente', 'Validée': 'valide', 'Refusée': 'refuse' }[data.statut] : '';

  return (
    <div className="saisie">
      <div className="saisie-tete">
        <div>
          <h1>{prenom ? `Suivi du temps — ${data ? `${data.collab.prenom} ${data.collab.nom}` : prenom}` : 'Suivi du temps de travail'}</h1>
          <p className="fuseau">🌐 Fuseau horaire de l&apos;entreprise : Europe/Paris</p>
        </div>
        <div className="total-mois">
          <small>Total</small>
          <strong>{nb(total)} j</strong>
          {data && <span className={`statut ${statutClasse}`}>{data.statut === 'A compléter' ? 'Brouillon' : data.statut}</span>}
        </div>
      </div>

      <div className="onglets">
        <button className={vue === 'liste' ? 'actif' : ''} onClick={() => aller({ vue: 'liste' })}>Liste</button>
        <button className={vue === 'calendrier' ? 'actif' : ''} onClick={() => aller({ vue: 'calendrier' })}>Calendrier</button>
      </div>

      <div className="barre-mois">
        <button className="btn btn-sec btn-sm" onClick={() => aller({ ym: aujourdhuiParis().slice(0, 7) })}>Aujourd&apos;hui</button>
        <button className="fleche" aria-label="Mois précédent" onClick={() => aller({ ym: moisDecale(ym, -1) })}>‹</button>
        <button className="fleche" aria-label="Mois suivant" onClick={() => aller({ ym: moisDecale(ym, 1) })}>›</button>
        <h2>{frMois(ym).replace(/^./, x => x.toUpperCase())}</h2>
        <span className="espace" />
        {vue === 'liste' && <label className="case"><input type="checkbox" checked={voirWeekends} onChange={e => setVoirWeekends(e.target.checked)} /> Afficher les week-ends</label>}
        <button className="lien" onClick={() => setPanneau('commentaires')}>Voir les commentaires</button>
        {data && !data.vueAdmin && (data.statut === 'A compléter' || data.statut === 'Refusée') && (
          <button className="btn btn-pri" disabled={enCours || !data.editable} onClick={() => workflow('soumettre')}>Soumettre le mois</button>
        )}
        {data?.vueAdmin && <>
          {data.statut !== 'Validée' && <button className="btn btn-pri" disabled={enCours} onClick={() => workflow('valider')}>Valider le mois</button>}
          {data.statut !== 'Refusée' && <button className="btn btn-sec" disabled={enCours} onClick={() => setPanneau('refus')}>Refuser…</button>}
          {data.statut !== 'A compléter' && <button className="btn btn-sec" disabled={enCours} onClick={() => workflow('rouvrir')}>Rouvrir</button>}
        </>}
      </div>

      {data && (
        <div className="bandeaux">
          {data.env === 'test' && <div className="bandeau info">Environnement de test : les saisies sont écrites dans la table « Temps W TEST ».</div>}
          {data.statut === 'Refusée' && data.motifRefus && <div className="bandeau err"><strong>Mois refusé.</strong> {data.motifRefus} — corrige ta saisie puis soumets de nouveau.</div>}
          {data.raisonVerrou && <div className="bandeau info">🔒 {data.raisonVerrou}</div>}
          {!data.absencesDisponibles && <div className="bandeau warn">Calendrier d&apos;absences Payfit indisponible : les absences ne sont pas pré-remplies.</div>}
          {data.conflits.length > 0 && <div className="bandeau err">{data.conflits.length} créneau(x) saisi(s) pendant une absence enregistrée dans Payfit : vide ces créneaux, ou corrige l&apos;absence dans Payfit.</div>}
          <div className="completude">
            <div className="barre"><div style={{ width: `${data.completude.attendus ? (100 * data.completude.couverts) / data.completude.attendus : 0}%` }} /></div>
            <span>{nb(data.completude.couverts / 2)} / {nb(data.completude.attendus / 2)} j ouvrés couverts
              {data.completude.manquants.length > 0 && <> — <button className="lien" onClick={() => setPanneau('manquants')}>{data.completude.manquants.length} créneau(x) à compléter</button></>}
            </span>
          </div>
        </div>
      )}

      {erreur && <div className="bandeau err" role="alert">{erreur} <button className="lien" onClick={() => setErreur(null)}>fermer</button></div>}
      {info && <div className="bandeau ok" role="status">{info} <button className="lien" onClick={() => setInfo(null)}>fermer</button></div>}

      {chargement ? <div className="chargement">Chargement du mois…</div> : data && (vue === 'liste' ? vueListe() : vueCalendrier())}

      {selection.size > 0 && (
        <div className="barre-selection">
          <span>{selection.size} créneau{selection.size > 1 ? 'x' : ''} sélectionné{selection.size > 1 ? 's' : ''}</span>
          <button className="btn btn-pri btn-sm" onClick={() => setSelecteur([...selection])}>Choisir une affaire</button>
          <button className="btn btn-sec btn-sm" onClick={() => preparer([...selection], null)}>Vider</button>
          <button className="lien" onClick={() => setSelection(new Set())}>Annuler</button>
        </div>
      )}
      {enCours && <div className="sauvegarde">Enregistrement…</div>}

      {selecteur && (
        <SelecteurAffaire affaires={affaires} mesIds={mesIds} recentes={recentes} nbCreneaux={selecteur.length}
          onChoisir={choisir} onFermer={() => setSelecteur(null)} />
      )}

      {confirmation && (
        <div className="voile" onMouseDown={() => setConfirmation(null)}>
          <div className="dialogue" onMouseDown={e => e.stopPropagation()} role="alertdialog">
            {confirmation.clos.length > 0 && <>
              <h3>Cette affaire est terminée, confirmes-tu la saisie de temps ?</h3>
              <ul>{confirmation.clos.map(a => <li key={a.id}><strong>{a.code}</strong> — {a.nom} · état « {a.etat} »</li>)}</ul>
            </>}
            {confirmation.nonOuvres.length > 0 && <>
              <h3>{confirmation.clos.length ? 'Et ' : ''}{confirmation.nonOuvres.length > 1 ? 'ces jours ne sont pas ouvrés' : 'ce jour n\'est pas ouvré'} : confirmes-tu ce temps ?</h3>
              <ul>{confirmation.nonOuvres.map(d => <li key={d}>{frDateLong(d)}{jourParDate.get(d)?.ferie ? ` — ${jourParDate.get(d)!.ferie}` : ''}</li>)}</ul>
            </>}
            <div className="dialogue-actions">
              <button className="btn btn-sec" onClick={() => { const cles = confirmation.changements.map(c => k(c.date, c.creneau)); setConfirmation(null); setSelecteur(cles); }}>
                Modifier la saisie
              </button>
              <button className="btn btn-pri" onClick={() => {
                const ch = confirmation.changements.map(c => ({ ...c, confirmClot: true, confirmNonOuvre: true }));
                setConfirmation(null); envoyer(ch);
              }}>
                {confirmation.clos.length ? 'Je sais que cette affaire est terminée, je conserve tout de même ma saisie' : 'Je confirme ce temps'}
              </button>
            </div>
          </div>
        </div>
      )}

      {panneau === 'manquants' && data && (
        <Panneau titre="Créneaux à compléter" onFermer={() => setPanneau(null)}>
          {data.completude.manquants.length === 0 ? <p>Le mois est complet.</p> : (
            <ul className="liste-manquants">
              {data.completude.manquants.map(m => (
                <li key={k(m.date, m.creneau)}>
                  <button className="lien" onClick={() => {
                    setPanneau(null); aller({ vue: 'liste' });
                    setTimeout(() => document.getElementById(`c-${m.date}-${m.creneau}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                  }}>{frDateLong(m.date)} — {LIB[m.creneau].toLowerCase()}</button>
                </li>
              ))}
            </ul>
          )}
        </Panneau>
      )}
      {panneau === 'refus' && <Refus onFermer={() => setPanneau(null)} onValider={m => workflow('refuser', m)} />}
      {panneau === 'commentaires' && <Commentaires ym={ym} prenom={prenom} onFermer={() => setPanneau(null)} />}
    </div>
  );
}

function Panneau({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: React.ReactNode }) {
  return (
    <div className="voile" onMouseDown={onFermer}>
      <aside className="panneau" onMouseDown={e => e.stopPropagation()}>
        <div className="panneau-tete"><h3>{titre}</h3><button className="vider" onClick={onFermer} aria-label="Fermer">×</button></div>
        <div className="panneau-corps">{children}</div>
      </aside>
    </div>
  );
}

function Refus({ onFermer, onValider }: { onFermer: () => void; onValider: (motif: string) => void }) {
  const [m, setM] = useState('');
  return (
    <Panneau titre="Refuser le mois" onFermer={onFermer}>
      <p>Le motif est visible du collaborateur et ajouté aux commentaires du mois.</p>
      <textarea value={m} onChange={e => setM(e.target.value)} rows={5} placeholder="Motif du refus…" autoFocus />
      <button className="btn btn-pri" disabled={!m.trim()} onClick={() => onValider(m)}>Refuser le mois</button>
    </Panneau>
  );
}

function Commentaires({ ym, prenom, onFermer }: { ym: string; prenom?: string; onFermer: () => void }) {
  const [liste, setListe] = useState<Commentaire[] | null>(null);
  const [texte, setTexte] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const q = prenom ? `&prenom=${encodeURIComponent(prenom)}` : '';
  useEffect(() => { appel<Commentaire[]>(`/api/commentaires?ym=${ym}${q}`).then(setListe).catch(e => setErr(e.message)); }, [ym, q]);
  async function envoyer() {
    try { setListe(await appel<Commentaire[]>('/api/commentaires', { method: 'POST', body: JSON.stringify({ ym, prenom, texte }) })); setTexte(''); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <Panneau titre={`Commentaires — ${frMois(ym)}`} onFermer={onFermer}>
      {err && <div className="bandeau err">{err}</div>}
      {!liste ? <p>Chargement…</p> : liste.length === 0 ? <p className="discret">Aucun commentaire sur ce mois.</p> : (
        <ul className="fil">{liste.map(c => (
          <li key={c.id}><div className="fil-auteur">{c.auteurNom} <span>{c.creeLe ? new Date(c.creeLe).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span></div><div>{c.texte}</div></li>
        ))}</ul>
      )}
      <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={3} placeholder="Ajouter un commentaire…" />
      <button className="btn btn-pri btn-sm" disabled={!texte.trim()} onClick={envoyer}>Envoyer</button>
    </Panneau>
  );
}


'use client';
// « Mon suivi de temps de travail » — vues Liste et Calendrier, sélection
// multiple, copie de semaine, confirmations, soumission du mois, commentaires.
// Utilisé aussi par l'Admin pour relire, corriger et valider le mois d'un
// collaborateur (prop `prenom`).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AffaireLite, Changement, Creneau, DonneesMois, Jour, Commentaire } from '@/lib/types';
import {
  aujourdhuiParis, moisDecale, frMois, frDateLong, semaineIso, lundiDe, addDays, estOuvre, dow,
} from '@/lib/dates';
import SelecteurAffaire from './SelecteurAffaire';
import { couleurAffaire, couleursDuMois } from './couleurs';
import MonMois from './MonMois';

const CRENEAUX: Creneau[] = ['AM', 'PM'];
const LIB: Record<Creneau, string> = { AM: 'Matinée', PM: 'Après-midi' };
const k = (d: string, c: Creneau) => `${d}|${c}`;
const nb = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

type Vue = 'liste' | 'calendrier';
interface Confirmation { clos: AffaireLite[]; nonOuvres: string[]; changements: Changement[]; suite?: () => void; depuisPanneau?: boolean }

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
  const [selecteurPanneau, setSelecteurPanneau] = useState(false);
  // Brouillon du panneau « Créneaux à compléter » : créneau → affaire, enregistré d'un bloc.
  const [brouillon, setBrouillon] = useState<Map<string, string>>(new Map());
  const [selPanneau, setSelPanneau] = useState<Set<string>>(new Set());
  const ancrePanneau = useRef<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [masquerWeekends, setMasquerWeekends] = useState(false);
  useEffect(() => { try { setMasquerWeekends(localStorage.getItem('tpsw_masquer_weekends') === '1'); } catch { /* stockage indisponible */ } }, []);
  const basculerWeekends = (v: boolean) => {
    setMasquerWeekends(v);
    try { localStorage.setItem('tpsw_masquer_weekends', v ? '1' : '0'); } catch { /* stockage indisponible */ }
  };
  // Glisser-déposer d'un créneau rempli vers des créneaux vides.
  const [glisse, setGlisse] = useState<{ affaireId: string; x: number; y: number; cibles: Set<string> } | null>(null);
  const ignorerClicJusqua = useRef(0);
  // Maj + clic : dernier créneau coché, origine de la plage.
  const ancre = useRef<string | null>(null);
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
  useEffect(() => { if (params.get('commentaires') === '1') setPanneau('commentaires'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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

  // Une couleur distincte par affaire du mois, partagée par la liste, le calendrier et « Mon mois ».
  const couleursMois = useMemo(() => {
    const jours = new Map<string, number>();
    for (const c of data?.creneaux || []) if (c.affaireId) jours.set(c.affaireId, (jours.get(c.affaireId) || 0) + 0.5);
    return couleursDuMois(jours, affParId);
  }, [data, affParId]);
  const couleur = (a: AffaireLite) => couleursMois.get(a.id) ?? couleurAffaire(a);

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
  async function envoyer(changements: Changement[]): Promise<boolean> {
    if (!changements.length) return false;
    setEnCours(true); setErreur(null);
    try {
      const d = await appel<DonneesMois>('/api/mois', { method: 'PUT', body: JSON.stringify({ ym, prenom, changements }) });
      setData(d); setSelection(new Set());
      return true;
    } catch (e) {
      setErreur((e as Error).message);
      return false;
    } finally { setEnCours(false); }
  }

  function preparer(cles: string[], a: AffaireLite | null) {
    const changements: Changement[] = cles.map(x => {
      const [date, c] = x.split('|') as [string, Creneau];
      return { date, creneau: c, affaireId: a?.id ?? null };
    });
    proposer(changements);
  }

  function proposer(changements: Changement[], suite?: () => void, depuisPanneau = false) {
    const clos = new Map<string, AffaireLite>();
    const nonOuvres = new Set<string>();
    for (const ch of changements) {
      if (!ch.affaireId) continue;
      const a = affParId.get(ch.affaireId);
      const deja = creneaux.get(k(ch.date, ch.creneau));
      if (a?.clos && !(deja?.affaireId === a.id && deja.confirmClot)) clos.set(a.id, a);
      if (!estOuvre(ch.date) && !(deja?.affaireId && deja.confirmNonOuvre)) nonOuvres.add(ch.date);
    }
    if (clos.size || nonOuvres.size) setConfirmation({ clos: [...clos.values()], nonOuvres: [...nonOuvres].sort(), changements, suite, depuisPanneau });
    else envoyer(changements.map(ch => ({ ...ch, confirmClot: true, confirmNonOuvre: true }))).then(ok => { if (ok) suite?.(); });
  }

  // Panneau des créneaux manquants : enregistre le brouillon, puis soumet le mois si demandé.
  function validerBrouillon(soumettre: boolean) {
    const changements: Changement[] = [...brouillon].map(([cle, affaireId]) => {
      const [date, c] = cle.split('|') as [string, Creneau];
      return { date, creneau: c, affaireId };
    });
    if (!changements.length) { if (soumettre) workflow('soumettre'); return; }
    proposer(changements, () => {
      setBrouillon(new Map());
      if (soumettre) workflow('soumettre');
      else setInfo(`${changements.length} créneau${changements.length > 1 ? 'x' : ''} enregistré${changements.length > 1 ? 's' : ''}.`);
    }, true);
  }

  function choisir(a: AffaireLite | null) {
    const cles = selecteur || [];
    setSelecteur(null);
    if (a) { noterRecente(a.id); setRecentes(lireRecentes()); }
    if (selecteurPanneau) {
      setSelecteurPanneau(false);
      setBrouillon(b => { const n = new Map(b); cles.forEach(c => { if (a) n.set(c, a.id); else n.delete(c); }); return n; });
      setSelPanneau(new Set());
      return;
    }
    preparer(cles, a);
  }
  const ouvrirSelecteurPanneau = (cles: string[]) => { setSelecteurPanneau(true); setSelecteur(cles); };
  function cocherPanneau(cle: string, plage: boolean) {
    const ordre = (data?.completude.manquants || []).map(m => k(m.date, m.creneau));
    const depuis = ancrePanneau.current;
    if (plage && depuis && depuis !== cle) {
      const a = ordre.indexOf(depuis), b = ordre.indexOf(cle);
      if (a >= 0 && b >= 0) {
        const morceau = ordre.slice(Math.min(a, b), Math.max(a, b) + 1);
        setSelPanneau(s => { const n = new Set(s); morceau.forEach(x => n.add(x)); return n; });
        ancrePanneau.current = cle;
        return;
      }
    }
    setSelPanneau(s => { const n = new Set(s); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
    ancrePanneau.current = cle;
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

  // Créneaux sélectionnables, dans l'ordre d'affichage (jour, matin puis après-midi).
  function ordreSelectionnable(): string[] {
    const out: string[] = [];
    for (const j of data?.jours || []) {
      const rempli = CRENEAUX.some(c => creneaux.get(k(j.date, c))?.affaireId);
      if (vue === 'liste' && masquerWeekends && j.weekend && !rempli) continue;
      for (const c of CRENEAUX) {
        if (verrouille(j.date, c) || (j.absence[c] && !creneaux.get(k(j.date, c))?.affaireId)) continue;
        out.push(k(j.date, c));
      }
    }
    return out;
  }

  // Clic sur une case : bascule ; avec Maj, sélectionne toute la plage depuis le dernier créneau coché.
  function cocher(cle: string, plage: boolean) {
    const depuis = ancre.current;
    if (plage && depuis && depuis !== cle) {
      const ordre = ordreSelectionnable();
      const a = ordre.indexOf(depuis), b = ordre.indexOf(cle);
      if (a >= 0 && b >= 0) {
        const morceau = ordre.slice(Math.min(a, b), Math.max(a, b) + 1);
        setSelection(s => { const n = new Set(s); morceau.forEach(x => n.add(x)); return n; });
        ancre.current = cle;
        return;
      }
    }
    basculer(cle);
    ancre.current = cle;
  }

  // Glisser un créneau rempli : chaque créneau vide survolé est retenu, et
  // l'affaire y est appliquée au relâchement (avec les confirmations
  // habituelles). Sous 6 px de déplacement, c'est un simple clic.
  function debutGlisse(e: React.PointerEvent, source: string, affaireId: string, vers: 'saisie' | 'brouillon' = 'saisie') {
    if (e.button !== 0 || !data?.editable || enCours) return;
    const x0 = e.clientX, y0 = e.clientY;
    let actif = false;
    const cibles = new Set<string>();
    const bouge = (ev: PointerEvent) => {
      if (!actif) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        actif = true;
        document.body.classList.add('glisse-en-cours');
      }
      ev.preventDefault();
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(vers === 'brouillon' ? '[data-cle-brouillon]' : '[data-cle]') as HTMLElement | null;
      const c = vers === 'brouillon' ? el?.dataset.cleBrouillon : el?.dataset.cle;
      const vide = vers === 'brouillon' ? !brouillon.has(c || '') : !creneaux.get(c || '')?.affaireId;
      if (c && c !== source && vide) cibles.add(c);
      setGlisse({ affaireId, x: ev.clientX, y: ev.clientY, cibles: new Set(cibles) });
    };
    const fin = () => {
      window.removeEventListener('pointermove', bouge);
      window.removeEventListener('pointerup', fin);
      window.removeEventListener('pointercancel', fin);
      document.body.classList.remove('glisse-en-cours');
      if (!actif) return;
      ignorerClicJusqua.current = Date.now() + 300;
      setGlisse(null);
      const a = affParId.get(affaireId);
      if (!a || !cibles.size) return;
      if (vers === 'brouillon') setBrouillon(b => { const n = new Map(b); cibles.forEach(c => n.set(c, a.id)); return n; });
      else preparer([...cibles], a);
    };
    window.addEventListener('pointermove', bouge);
    window.addEventListener('pointerup', fin);
    window.addEventListener('pointercancel', fin);
  }
  const clicIgnore = () => Date.now() < ignorerClicJusqua.current;

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
      ? <span className="pilule" title={`${a.code} — ${a.nom}`}><span className="pastille" style={{ background: couleur(a) }} />{a.code} <span className="pilule-nom">({a.nom})</span></span>
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
      <div className={`creneau ${selection.has(cle) ? 'sel' : ''} ${manquants.has(cle) ? 'manquant' : ''} ${glisse?.cibles.has(cle) ? 'cible-drop' : ''}`} key={c} id={`c-${j.date}-${c}`} data-cle={lock ? undefined : cle}>
        {lock ? <span /> : <input type="checkbox" aria-label={`Sélectionner ${LIB[c]} du ${frDateLong(j.date)}`} checked={selection.has(cle)} onChange={() => undefined} onClick={e => cocher(cle, e.shiftKey)} title="Maj + clic pour sélectionner une plage" />}
        <span className="lib">{LIB[c]}</span>
        <button className={`choix ${s?.affaireId ? 'rempli' : ''} ${s?.affaireId && !lock ? 'glissable' : ''}`} disabled={lock || enCours}
          title={s?.affaireId && !lock ? 'Cliquer pour changer · glisser vers des créneaux vides pour recopier' : undefined}
          onPointerDown={s?.affaireId && !lock ? e => debutGlisse(e, cle, s.affaireId!) : undefined}
          onClick={() => { if (!clicIgnore()) setSelecteur(selection.has(cle) && selection.size > 1 ? [...selection] : [cle]); }}>
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
          if (j.weekend && masquerWeekends && !aDesSaisies) return null;
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
                <button key={c} disabled={lock || enCours} data-cle={lock ? undefined : cle}
                  onPointerDown={a && !lock ? e => debutGlisse(e, cle, a.id) : undefined}
                  className={`cal-demi ${abs ? 'absence' : ''} ${selection.has(cle) ? 'sel' : ''} ${manquants.has(cle) ? 'manquant' : ''} ${conflits.has(cle) ? 'conflit' : ''} ${glisse?.cibles.has(cle) ? 'cible-drop' : ''} ${a && !lock ? 'glissable' : ''}`}
                  style={a && !abs ? { background: couleur(a), color: '#fff' } : undefined}
                  title={`${LIB[c]} — ${abs ? 'Absence (Payfit)' : a ? `${a.code} ${a.nom}` : 'vide'}${s?.confirmClot ? ' — affaire clôturée, saisie maintenue' : ''}`}
                  onClick={e => {
                    if (clicIgnore()) return;
                    if (e.shiftKey) cocher(cle, true);
                    else if (e.ctrlKey || e.metaKey || selection.size) cocher(cle, false);
                    else setSelecteur([cle]);
                  }}>
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
        </div>
        <div className="total-mois">
          <small>Total</small>
          <strong>{nb(total)} j</strong>
          {data && <span className={`statut ${statutClasse} ${data.modifieApresEnvoi ? 'a-resoumettre' : ''}`}>{data.modifieApresEnvoi ? 'À soumettre à nouveau' : data.statut === 'A compléter' ? 'Brouillon' : data.statut}</span>}
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
        {vue === 'liste' && <label className="case"><input type="checkbox" checked={masquerWeekends} onChange={e => basculerWeekends(e.target.checked)} /> Désactiver les week-ends</label>}
        <button className="lien" onClick={() => setPanneau('commentaires')}>{data?.vueAdmin ? 'Voir les commentaires' : 'Ajouter un commentaire sur son mois'}</button>
        {data && !data.vueAdmin && (data.statut === 'A compléter' || data.statut === 'Refusée') && (
          <button className="btn btn-pri" disabled={enCours || !data.editable || ym > aujourdhuiParis().slice(0, 7)} title={ym > aujourdhuiParis().slice(0, 7) ? 'Un mois futur ne peut être soumis qu\x27une fois commencé' : undefined} onClick={() => workflow('soumettre')}>{data.modifieApresEnvoi || data.statut === 'Refusée' ? 'Soumettre à nouveau' : 'Soumettre le mois'}</button>
        )}
        {data?.vueAdmin && <>
          {data.statut !== 'Validée' && <button className="btn btn-pri" disabled={enCours} onClick={() => workflow('valider')}>Valider le mois</button>}
          {data.statut !== 'Refusée' && <button className="btn btn-sec" disabled={enCours} onClick={() => setPanneau('refus')}>Refuser…</button>}
          {data.statut !== 'A compléter' && <button className="btn btn-sec" disabled={enCours} onClick={() => workflow('rouvrir')}>Rouvrir</button>}
        </>}
      </div>

      {data && !chargement && (
        <MonMois data={data} affParId={affParId} couleur={couleur}
          titre={prenom ? `Le mois ${/^[aeiouyhàâéèêëîïôöûü]/i.test(data.collab.prenom) ? 'd’' : 'de '}${data.collab.prenom}` : 'Mon mois'}
          onAller={(date, c) => {
          aller({ vue: 'liste' });
          setTimeout(() => document.getElementById(`c-${date}-${c}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
        }} />
      )}

      {data && (
        <div className="bandeaux">
          {!data.vueAdmin && data.modifieApresEnvoi && <div className="bandeau warn"><strong>Temps modifié après l&apos;envoi pour validation.</strong> N&apos;oublie pas de soumettre à nouveau ton temps de travail.</div>}
          {!data.vueAdmin && data.statut === 'En attente de validation' && <div className="bandeau info">Mois envoyé pour validation. Tu peux encore le modifier tant qu&apos;il n&apos;est pas validé : il faudra alors le soumettre à nouveau.</div>}
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

      {glisse && (
        <div className="badge-glisse" style={{ left: glisse.x + 14, top: glisse.y + 14 }}>
          {affParId.get(glisse.affaireId)?.code} → {glisse.cibles.size} créneau{glisse.cibles.size > 1 ? 'x' : ''}
        </div>
      )}
      {selection.size > 0 && (
        <div className="barre-selection">
          <span>{selection.size} créneau{selection.size > 1 ? 'x' : ''} sélectionné{selection.size > 1 ? 's' : ''}</span>
          <button className="btn btn-pri btn-sm" onClick={() => setSelecteur([...selection])}>Choisir une affaire</button>
          <button className="btn btn-sec btn-sm" onClick={() => preparer([...selection], null)}>Vider</button>
          <button className="lien" onClick={() => setSelection(new Set())}>Annuler</button>
        </div>
      )}
      {enCours && <div className="sauvegarde">Enregistrement…</div>}

      {panneau === 'manquants' && data && (() => {
        const manq = data.completude.manquants;
        const parJour = new Map<string, Creneau[]>();
        for (const m of manq) parJour.set(m.date, [...(parJour.get(m.date) || []), m.creneau]);
        const restants = manq.filter(m => !brouillon.has(k(m.date, m.creneau))).map(m => k(m.date, m.creneau));
        const peutSoumettre = !data.vueAdmin && (data.statut === 'A compléter' || data.statut === 'Refusée') && ym <= aujourdhuiParis().slice(0, 7);
        return (
          <Panneau titre="Créneaux à compléter" onFermer={() => { setPanneau(null); setBrouillon(new Map()); setSelPanneau(new Set()); }}>
            {erreur && <div className="bandeau err">{erreur}</div>}
            {manq.length === 0 ? <p>Le mois est complet.</p> : <>
              <p className="discret">{manq.length} créneau{manq.length > 1 ? 'x' : ''} ouvré{manq.length > 1 ? 's' : ''} sans affaire. Choisis une affaire pour chacun, puis soumets le mois.</p>
              {data.editable && restants.length > 1 && (
                <button className="btn btn-sec btn-sm" disabled={enCours} onClick={() => ouvrirSelecteurPanneau(restants)}>Tout remplir avec… ({restants.length})</button>
              )}
              {selPanneau.size > 0 && (
                <div className="manquants-selection">
                  <span>{selPanneau.size} sélectionné{selPanneau.size > 1 ? 's' : ''}</span>
                  <button className="btn btn-pri btn-sm" disabled={enCours} onClick={() => ouvrirSelecteurPanneau([...selPanneau])}>Choisir une affaire</button>
                  <button className="lien" onClick={() => setSelPanneau(new Set())}>Annuler</button>
                </div>
              )}
              <p className="aide-manquants">Astuce : glisse un créneau rempli vers les créneaux vides, ou coche avec Maj + clic pour sélectionner une plage.</p>
              <div className="manquants">
                {[...parJour].map(([date, cs]) => (
                  <div className="manquant-jour" key={date}>
                    <div className="manquant-date">{frDateLong(date)}</div>
                    {cs.map(c => {
                      const cle = k(date, c);
                      const choisi = brouillon.get(cle) || null;
                      return (
                        <div className={`creneau ${choisi ? '' : 'manquant'} ${selPanneau.has(cle) ? 'sel' : ''} ${glisse?.cibles.has(cle) ? 'cible-drop' : ''}`} key={cle} data-cle-brouillon={data.editable ? cle : undefined}>
                          {data.editable
                            ? <input type="checkbox" aria-label={`Sélectionner ${LIB[c]} du ${frDateLong(date)}`} checked={selPanneau.has(cle)} onChange={() => undefined} onClick={e => cocherPanneau(cle, e.shiftKey)} title="Maj + clic pour sélectionner une plage" />
                            : <span />}
                          <span className="lib">{LIB[c]}</span>
                          <button className={`choix ${choisi ? 'rempli' : ''} ${choisi && data.editable ? 'glissable' : ''}`} disabled={!data.editable || enCours}
                            title={choisi ? 'Cliquer pour changer · glisser vers des créneaux vides pour recopier' : undefined}
                            onPointerDown={choisi && data.editable ? e => debutGlisse(e, cle, choisi, 'brouillon') : undefined}
                            onClick={() => { if (!clicIgnore()) ouvrirSelecteurPanneau(selPanneau.has(cle) && selPanneau.size > 1 ? [...selPanneau] : [cle]); }}>
                            {pilule(choisi, cle)}<span className="chevron">▾</span>
                          </button>
                          {choisi && <button className="vider" title="Retirer" disabled={enCours} onClick={() => setBrouillon(b => { const n = new Map(b); n.delete(cle); return n; })}>×</button>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>}
            <div className="manquants-actions">
              {peutSoumettre && (
                <button className="btn btn-pri" disabled={enCours || !data.editable || restants.length > 0} onClick={() => validerBrouillon(true)}
                  title={restants.length ? `Encore ${restants.length} créneau(x) à remplir` : undefined}>
                  Soumettre à validation{restants.length > 0 ? ` (${restants.length} restant${restants.length > 1 ? 's' : ''})` : ''}
                </button>
              )}
              {brouillon.size > 0 && (
                <button className="btn btn-sec" disabled={enCours} onClick={() => validerBrouillon(false)}>
                  Enregistrer {peutSoumettre ? 'sans soumettre' : ''}
                </button>
              )}
            </div>
          </Panneau>
        );
      })()}
      {panneau === 'refus' && <Refus onFermer={() => setPanneau(null)} onValider={m => workflow('refuser', m)} />}
      {panneau === 'commentaires' && <Commentaires ym={ym} prenom={prenom} onFermer={() => setPanneau(null)} onAller={m => { setPanneau(null); aller({ ym: m }); }} />}

      {selecteur && (
        <SelecteurAffaire affaires={affaires} mesIds={mesIds} recentes={recentes} nbCreneaux={selecteur.length}
          onChoisir={choisir} onFermer={() => { setSelecteur(null); setSelecteurPanneau(false); }} />
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
              <button className="btn btn-sec" onClick={() => { const cles = confirmation.changements.map(c => k(c.date, c.creneau)); const p = confirmation.depuisPanneau; setConfirmation(null); if (!p) setSelecteur(cles); }}>
                Modifier la saisie
              </button>
              <button className="btn btn-pri" onClick={() => {
                const ch = confirmation.changements.map(c => ({ ...c, confirmClot: true, confirmNonOuvre: true }));
                const suite = confirmation.suite;
                setConfirmation(null); envoyer(ch).then(ok => { if (ok) suite?.(); });
              }}>
                {confirmation.clos.length ? 'Je sais que cette affaire est terminée, je conserve tout de même ma saisie' : 'Je confirme ce temps'}
              </button>
            </div>
          </div>
        </div>
      )}

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

function Commentaires({ ym, prenom, onFermer, onAller }: { ym: string; prenom?: string; onFermer: () => void; onAller: (ym: string) => void }) {
  const [vue, setVue] = useState<'mois' | 'tous'>('mois');
  const [liste, setListe] = useState<Commentaire[] | null>(null);
  const [texte, setTexte] = useState('');
  const [edition, setEdition] = useState<{ id: string; texte: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const q = prenom ? `&prenom=${encodeURIComponent(prenom)}` : '';
  const url = vue === 'tous' ? `/api/commentaires?tous=1${q}` : `/api/commentaires?ym=${ym}${q}`;
  const recharger = useCallback(() => {
    setListe(null);
    appel<Commentaire[]>(url).then(setListe).catch(e => setErr(e.message));
  }, [url]);
  useEffect(() => { recharger(); }, [recharger]);

  async function envoyer() {
    setErr(null);
    try { await appel('/api/commentaires', { method: 'POST', body: JSON.stringify({ ym, prenom, texte }) }); setTexte(''); recharger(); }
    catch (e) { setErr((e as Error).message); }
  }
  async function enregistrerEdition() {
    if (!edition) return;
    setErr(null);
    try { await appel('/api/commentaires', { method: 'PATCH', body: JSON.stringify(edition) }); setEdition(null); recharger(); }
    catch (e) { setErr((e as Error).message); }
  }
  async function supprimerC(id: string) {
    if (!confirm('Supprimer ce commentaire ?')) return;
    setErr(null);
    try { await appel(`/api/commentaires?id=${id}`, { method: 'DELETE' }); recharger(); }
    catch (e) { setErr((e as Error).message); }
  }
  const date = (s: string) => (s ? new Date(s).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');

  return (
    <Panneau titre="Commentaires" onFermer={onFermer}>
      <div className="onglets comm-onglets">
        <button className={vue === 'mois' ? 'actif' : ''} onClick={() => setVue('mois')}>{frMois(ym).replace(/^./, x => x.toUpperCase())}</button>
        <button className={vue === 'tous' ? 'actif' : ''} onClick={() => setVue('tous')}>Historique</button>
      </div>
      {err && <div className="bandeau err">{err}</div>}
      {!liste ? <p>Chargement…</p> : liste.length === 0
        ? <p className="discret">{vue === 'tous' ? 'Aucun commentaire pour l’instant.' : 'Aucun commentaire sur ce mois.'}</p>
        : (
          <ul className="fil">{liste.map(c => (
            <li key={c.id}>
              <div className="fil-auteur">
                {c.auteurNom} <span>{date(c.creeLe)}</span>
                {vue === 'tous' && c.mois && <button className="lien fil-mois" onClick={() => onAller(c.mois)}>{frMois(c.mois)}</button>}
              </div>
              {edition?.id === c.id ? (
                <>
                  <textarea value={edition.texte} onChange={e => setEdition({ id: c.id, texte: e.target.value })} rows={3} autoFocus />
                  <div className="fil-actions">
                    <button className="btn btn-pri btn-sm" disabled={!edition.texte.trim()} onClick={enregistrerEdition}>Enregistrer</button>
                    <button className="btn btn-sec btn-sm" onClick={() => setEdition(null)}>Annuler</button>
                  </div>
                </>
              ) : (
                <>
                  <div>{c.texte}</div>
                  {c.modifiable && (
                    <div className="fil-actions">
                      <button className="lien" onClick={() => setEdition({ id: c.id, texte: c.texte })}>Modifier</button>
                      <button className="lien" onClick={() => supprimerC(c.id)}>Supprimer</button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}</ul>
        )}
      {vue === 'mois' && <>
        <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={3} placeholder="Ajouter un commentaire…" />
        <button className="btn btn-pri btn-sm" disabled={!texte.trim()} onClick={envoyer}>Envoyer</button>
      </>}
    </Panneau>
  );
}


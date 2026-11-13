'use client';
// Inspecteur de développement (Admin), repris de l'inspecteur d'AI Coupé
// (Assemblage-Ingenierie/AI-Coupe, js/inspector.js) et adapté à Next.js.
//
// Cliquer sur une partie de l'appli → zone, fichier et fonctions du code
// concerné, plus une remarque facultative. Chaque sélection est gardée :
//   · window.__tpswPick et localStorage « tpsw_pick » (dernière sélection),
//   · localStorage « tpsw_pick_history » (20 dernières),
// pour que Claude la lise depuis le volet navigateur (« regarde ma sélection »)
// ou qu'on la copie dans la conversation. Raccourci : Alt + I. Échap pour sortir.
import { useCallback, useEffect, useRef, useState } from 'react';

interface Code { file: string; fns: string[] }
interface Pick {
  id: string;
  zone: string;
  code: Code[];
  page: string;
  vue: string;
  text: string;
  tag: string;
  css_path: string;
  note: string;
  at: string;
}

// Zone de l'interface → code. Du plus précis au plus général : la première
// zone dont le sélecteur correspond (closest) l'emporte.
const S = 'components/Saisie.tsx';
const CSS = 'app/globals.css';
const ZONES: [string, string, Code[]][] = [
  ['.sel-tete', 'Sélecteur d’affaire — recherche', [{ file: 'components/SelecteurAffaire.tsx', fns: ['SelecteurAffaire (sel-tete)', 'clavier'] }]],
  ['.sel-section', 'Sélecteur d’affaire — titre de section', [{ file: 'components/SelecteurAffaire.tsx', fns: ['sections (useMemo)'] }]],
  ['.selecteur .option', 'Sélecteur d’affaire — ligne d’affaire', [{ file: 'components/SelecteurAffaire.tsx', fns: ['ligne'] }, { file: 'components/couleurs.ts', fns: ['couleurAffaire'] }]],
  ['.sel-plus', 'Sélecteur d’affaire — afficher les clôturées', [{ file: 'components/SelecteurAffaire.tsx', fns: ['voirClos'] }]],
  ['.sel-pied', 'Sélecteur d’affaire — pied (vider, aide clavier)', [{ file: 'components/SelecteurAffaire.tsx', fns: ['onChoisir(null)'] }]],
  ['.selecteur', 'Sélecteur d’affaire', [{ file: 'components/SelecteurAffaire.tsx', fns: ['SelecteurAffaire'] }, { file: CSS, fns: ['.selecteur, .option'] }]],
  ['.dialogue', 'Fenêtre de confirmation (affaire clôturée / jour non ouvré)', [{ file: S, fns: ['proposer', 'confirmation (rendu)'] }, { file: 'lib/mois.ts', fns: ['enregistrer (règles de confirmation)'] }]],
  ['.panneau .fil', 'Commentaires du mois', [{ file: S, fns: ['Commentaires'] }, { file: 'app/api/commentaires/route.ts', fns: ['GET', 'POST'] }]],
  ['.panneau .liste-manquants', 'Liste des créneaux à compléter', [{ file: S, fns: ['panneau === manquants'] }, { file: 'lib/mois.ts', fns: ['analyser'] }]],
  ['.panneau', 'Panneau latéral', [{ file: S, fns: ['Panneau', 'Commentaires', 'Refus'] }]],
  ['.barre-selection', 'Barre de sélection multiple', [{ file: S, fns: ['selection', 'basculer', 'preparer'] }]],
  ['.mention', 'Mention sous un créneau (clôturée, non ouvré, absence)', [{ file: S, fns: ['mentions'] }]],
  ['.creneau .choix', 'Créneau — bouton de choix d’affaire', [{ file: S, fns: ['creneauListe', 'pilule'] }, { file: CSS, fns: ['.choix, .pilule'] }]],
  ['.creneau .vider', 'Créneau — vider', [{ file: S, fns: ['creneauListe', 'preparer([cle], null)'] }]],
  ['.creneau.verrou', 'Créneau d’absence Payfit (verrouillé)', [{ file: S, fns: ['creneauListe (absence)'] }, { file: 'lib/payfit.ts', fns: ['parseICS', 'absencesDe'] }]],
  ['.creneau', 'Créneau (vue liste)', [{ file: S, fns: ['creneauListe'] }, { file: CSS, fns: ['.creneau'] }]],
  ['.jour-date', 'Date du jour (vue liste)', [{ file: S, fns: ['vueListe (jour-date)'] }, { file: 'lib/dates.ts', fns: ['frDateLong', 'ferieNom'] }]],
  ['.jour-total', 'Total du jour', [{ file: S, fns: ['vueListe (totalJ)'] }]],
  ['.jour', 'Ligne de jour (vue liste)', [{ file: S, fns: ['vueListe'] }, { file: CSS, fns: ['.jour'] }]],
  ['.semaine-tete', 'En-tête de semaine (copier, remplir)', [{ file: S, fns: ['vueListe (semaine-tete)', 'copierSemainePrecedente', 'remplirSemaine'] }]],
  ['.semaine', 'Bloc semaine (vue liste)', [{ file: S, fns: ['vueListe', 'semaines (useMemo)'] }]],
  ['.cal-demi', 'Demi-journée (vue calendrier)', [{ file: S, fns: ['vueCalendrier (cal-demi)'] }, { file: CSS, fns: ['.cal-demi'] }]],
  ['.cal-case', 'Case de jour (vue calendrier)', [{ file: S, fns: ['vueCalendrier'] }]],
  ['.calendrier', 'Vue calendrier', [{ file: S, fns: ['vueCalendrier'] }, { file: CSS, fns: ['.calendrier'] }]],
  ['.mm-attention', 'Mon mois — points d’attention', [{ file: 'components/MonMois.tsx', fns: ['points', 'groupes'] }]],
  ['.mon-mois', 'Mon mois — répartition et absences', [{ file: 'components/MonMois.tsx', fns: ['MonMois', 'segments'] }, { file: CSS, fns: ['.mon-mois, .mm-barre'] }]],
  ['.completude', 'Barre de complétude du mois', [{ file: S, fns: ['completude (rendu)'] }, { file: 'lib/mois.ts', fns: ['analyser'] }]],
  ['.bandeau', 'Bandeau d’information', [{ file: S, fns: ['bandeaux (rendu)'] }]],
  ['.barre-mois', 'Barre du mois (navigation, actions)', [{ file: S, fns: ['aller', 'workflow'] }]],
  ['.total-mois', 'Total et statut du mois', [{ file: S, fns: ['total', 'statutClasse'] }]],
  ['.saisie-tete', 'Titre de la page de saisie', [{ file: S, fns: ['Saisie (saisie-tete)'] }]],
  ['.saisie .onglets', 'Onglets Liste / Calendrier', [{ file: S, fns: ['aller({ vue })'] }]],
  ['.lat-pied', 'Menu latéral — utilisateur, bascule User / Admin, déconnexion', [{ file: 'components/Entete.tsx', fns: ['Entete (lat-pied)', 'changerVue'] }]],
  ['.lat-lien', 'Menu latéral — lien de navigation', [{ file: 'components/Entete.tsx', fns: ['sections', 'actif'] }]],
  ['.lat-tete', 'Menu latéral — logo et titre', [{ file: 'components/Entete.tsx', fns: ['Entete (lat-tete)'] }, { file: 'public/logo-assemblage-noir.png', fns: [] }]],
  ['.lateral', 'Menu latéral', [{ file: 'components/Entete.tsx', fns: ['Entete'] }, { file: CSS, fns: ['.lateral, .lat-*'] }]],
  ['.barre-mobile', 'Barre du haut (téléphone)', [{ file: 'components/Entete.tsx', fns: ['Entete (barre-mobile)'] }]],
  ['.login-box', 'Page de connexion', [{ file: 'app/login/page.tsx', fns: ['Login'] }]],
];

// Pages sans zone dédiée : le fichier de la page.
const PAGES: [RegExp, string, Code[]][] = [
  [/^\/affaires/, 'Mes affaires', [{ file: 'app/(app)/affaires/page.tsx', fns: ['MesAffaires'] }, { file: 'app/api/affaires/route.ts', fns: ['GET'] }]],
  [/^\/admin\/validation/, 'Validation mensuelle', [{ file: 'app/(app)/admin/validation/page.tsx', fns: ['Validation'] }, { file: 'app/api/admin/validation/route.ts', fns: ['GET', 'POST'] }]],
  [/^\/admin\/balances/, 'Balances', [{ file: 'app/(app)/admin/balances/page.tsx', fns: ['PageBalances'] }, { file: 'app/api/admin/balances/route.ts', fns: ['GET'] }]],
  [/^\/admin\/parametres/, 'Paramètres', [{ file: 'app/(app)/admin/parametres/page.tsx', fns: ['PageParametres'] }]],
  [/^\/admin\/collaborateur/, 'Mois d’un collaborateur (Admin)', [{ file: S, fns: ['Saisie (prenom)'] }, { file: 'app/(app)/admin/collaborateur/page.tsx', fns: ['PageCollaborateur'] }]],
];

function zoneOf(t: Element): { zone: string; code: Code[] } {
  for (const [sel, zone, code] of ZONES) if (t.closest(sel)) return { zone, code };
  const p = location.pathname;
  for (const [re, zone, code] of PAGES) if (re.test(p)) return { zone: t.closest('table') ? `${zone} — tableau` : zone, code };
  return { zone: 'Page', code: [{ file: S, fns: ['Saisie'] }] };
}

function cssPath(e: Element | null): string {
  const parts: string[] = [];
  while (e && e.nodeType === 1 && e !== document.body && parts.length < 5) {
    let s = e.tagName.toLowerCase();
    if (e.id) { parts.unshift(s + '#' + e.id); break; }
    const cls = [...e.classList].filter(c => !c.startsWith('insp')).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    parts.unshift(s);
    e = e.parentElement;
  }
  return parts.join(' > ');
}

function describe(t: Element): Pick {
  const { zone, code } = zoneOf(t);
  const vue = document.querySelector('.onglets .actif')?.textContent?.trim() || '';
  const brut = (t as HTMLElement).innerText || t.getAttribute('aria-label') || t.getAttribute('placeholder') || '';
  return {
    id: String(Date.now()), zone, code, page: location.pathname + location.search, vue,
    text: brut.replace(/\s+/g, ' ').trim().slice(0, 120),
    tag: t.tagName.toLowerCase(), css_path: cssPath(t), note: '', at: new Date().toISOString(),
  };
}

function toText(p: Pick): string {
  const l = [`[Carnet — sélection inspecteur] Page ${p.page}${p.vue ? ` · vue « ${p.vue} »` : ''} · zone « ${p.zone} »`];
  p.code.forEach(c => l.push(`  ${c.file}${c.fns.length ? ' : ' + c.fns.join(', ') : ''}`));
  l.push(`  élément HTML : <${p.tag}> ${p.css_path}${p.text ? ' — « ' + p.text + ' »' : ''}`);
  if (p.note) l.push(`  À modifier : ${p.note}`);
  return l.join('\n');
}

const lireHist = (): Pick[] => { try { return JSON.parse(localStorage.getItem('tpsw_pick_history') || '[]'); } catch { return []; } };
function enregistrer(p: Pick): Pick[] {
  (window as any).__tpswPick = p;
  const hist = [p, ...lireHist().filter(x => x.id !== p.id)].slice(0, 20);
  try { localStorage.setItem('tpsw_pick', JSON.stringify(p)); localStorage.setItem('tpsw_pick_history', JSON.stringify(hist)); } catch { /* stockage indisponible */ }
  return hist;
}

async function copier(txt: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(txt); return true; } catch { return false; }
}

export default function Inspecteur() {
  const [picking, setPicking] = useState(false);
  const [survol, setSurvol] = useState<{ r: DOMRect; label: string; x: number; y: number } | null>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [hist, setHist] = useState<Pick[]>([]);
  const [liste, setListe] = useState(false);
  const [msg, setMsg] = useState('');
  const hovered = useRef<Element | null>(null);

  useEffect(() => {
    setHist(lireHist());
    // Pour Claude (lecture depuis le volet navigateur).
    (window as any).TPSWInspector = {
      last: () => (window as any).__tpswPick || JSON.parse(localStorage.getItem('tpsw_pick') || 'null'),
      history: lireHist,
      text: () => { const p = (window as any).TPSWInspector.last(); return p ? toText(p) : 'Aucune sélection.'; },
      textAll: () => lireHist().filter(p => p.note).map(toText).join('\n\n') || 'Aucune note.',
    };
  }, []);

  const stop = useCallback(() => { setPicking(false); setSurvol(null); hovered.current = null; }, []);
  const start = useCallback(() => { setPick(null); setListe(false); setPicking(true); }, []);

  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.altKey && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); if (picking) stop(); else start(); } };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [picking, start, stop]);

  useEffect(() => {
    if (!picking) return;
    const horsOutil = (t: EventTarget | null) => t instanceof Element && !t.closest('.insp-ui');
    const onMove = (e: MouseEvent) => {
      const t = document.elementFromPoint(e.clientX, e.clientY);
      if (!t || !horsOutil(t)) { setSurvol(null); hovered.current = null; return; }
      hovered.current = t;
      const z = zoneOf(t);
      setSurvol({ r: t.getBoundingClientRect(), label: `${z.zone} — ${z.code.map(c => c.file).join(', ')}`, x: e.clientX, y: e.clientY });
    };
    const onPick = (e: MouseEvent) => {
      if (!horsOutil(e.target)) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      const p = describe(hovered.current || (e.target as Element));
      stop();
      setHist(enregistrer(p)); setPick(p); setMsg('Sélection enregistrée — dites à Claude « regarde ma sélection ».');
    };
    const block = (e: Event) => { if (horsOutil(e.target)) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); stop(); } };
    const bloques = ['mousedown', 'mouseup', 'pointerdown', 'input', 'change'];
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onPick, true);
    bloques.forEach(t => document.addEventListener(t, block, true));
    document.addEventListener('keydown', onKey, true);
    document.body.style.cursor = 'crosshair';
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onPick, true);
      bloques.forEach(t => document.removeEventListener(t, block, true));
      document.removeEventListener('keydown', onKey, true);
      document.body.style.cursor = '';
    };
  }, [picking, stop]);

  function noter(note: string) {
    if (!pick) return;
    const p = { ...pick, note };
    setPick(p); setHist(enregistrer(p));
  }
  function retirer(id: string) {
    const h = lireHist().filter(x => x.id !== id);
    try { localStorage.setItem('tpsw_pick_history', JSON.stringify(h)); } catch { /* */ }
    setHist(h);
  }

  const notes = hist.filter(p => p.note);

  return (
    <div className="insp-ui">
      {picking && survol && <>
        <div className="insp-box" style={{ left: survol.r.left, top: survol.r.top, width: survol.r.width, height: survol.r.height }} />
        <div className="insp-tip" style={{ left: Math.min(survol.x + 12, window.innerWidth - 370), top: survol.y + 16 }}>{survol.label}</div>
      </>}

      {pick && (
        <div className="insp-panel">
          <h4>{pick.zone}</h4>
          <div className="k">Code concerné</div>
          {pick.code.map(c => <div key={c.file}><code>{c.file}</code>{c.fns.length > 0 && <> → {c.fns.map(f => <code key={f}>{f}</code>)}</>}</div>)}
          <div className="k">Élément HTML</div>
          <div><code>&lt;{pick.tag}&gt;</code> {pick.text}</div>
          <div className="k">Ce que vous voulez changer (facultatif)</div>
          <textarea autoFocus value={pick.note} onChange={e => noter(e.target.value)} placeholder="ex. agrandir ce texte, changer la couleur, déplacer ce bouton…" />
          <div className="row">
            <button className="p" onClick={async () => setMsg(await copier(toText(pick)) ? 'Copié — collez-le dans la conversation avec Claude.' : 'Copie impossible : sélectionnez le texte et faites Ctrl + C.')}>Copier pour Claude</button>
            <button onClick={start}>Nouvelle sélection</button>
            <button onClick={() => setPick(null)}>Fermer</button>
          </div>
          <div className="ok">{msg}</div>
        </div>
      )}

      {liste && !pick && (
        <div className="insp-panel">
          <h4>Notes ({notes.length})</h4>
          {notes.length === 0
            ? <p>Sélectionnez une zone et écrivez ce que vous voulez changer : la note apparaît ici.</p>
            : <ol className="insp-notes">{notes.map(p => (
                <li key={p.id}><div>{p.note}</div><small>{p.zone} · {p.page}</small> <button className="lien-insp" onClick={() => retirer(p.id)}>retirer</button></li>
              ))}</ol>}
          <div className="row">
            <button className="p" disabled={!notes.length} onClick={async () => setMsg(await copier(notes.map(toText).join('\n\n')) ? 'Toutes les notes sont copiées.' : 'Copie impossible.')}>Copier toutes les notes</button>
            <button disabled={!hist.length} onClick={() => { if (confirm('Effacer toutes les sélections et notes ?')) { try { localStorage.removeItem('tpsw_pick_history'); localStorage.removeItem('tpsw_pick'); } catch { /* */ } setHist([]); } }}>Tout effacer</button>
            <button onClick={() => setListe(false)}>Fermer</button>
          </div>
          <div className="ok">{msg}</div>
        </div>
      )}

      <div className="insp-barre">
        <button className={`insp-btn ${picking ? 'on' : ''}`} onClick={() => (picking ? stop() : start())} title="Cliquer sur une partie de l’appli pour identifier le code (Alt + I)">
          {picking ? '🎯 Cliquez sur une zone… (Échap)' : '🎯 Inspecter'}
        </button>
        <button className="insp-btn" onClick={() => { setPick(null); setListe(l => !l); setMsg(''); }}>
          Notes{notes.length > 0 && <span className="insp-nb">{notes.length}</span>}
        </button>
      </div>
    </div>
  );
}

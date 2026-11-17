'use client';
// Fenêtre « Créer une affaire » : mêmes champs que le formulaire Airtable de la
// table Affaire (sections Contractuel et Gestion de projet). « Envoyer » crée
// la fiche dans Airtable ; les organisations viennent du CRM (Sync CRM).
import { useEffect, useMemo, useRef, useState } from 'react';
import * as O from '@/lib/options-affaire';
import type { NouvelleAffaire, Organisation } from '@/lib/options-affaire';

const vide = (moi: string): NouvelleAffaire => ({
  clef: '', codeMoa: '', codeAdresse: '', pole: '', etat: '', contrat: '',
  architecte: [], moa: [], bet: [], entreprise: [], adresse: '',
  progPrincipaux: [], progSecondaires: [], materiaux: [], rehabNeuf: [],
  surface: null, budgetHT: null, manager: '', cdp: O.CDPS.includes(moi) ? [moi] : [], marchePI: null,
  specFacturation: '', siret: '', codeMarche: '', codeService: '', engagement: '',
});

// Ferme un menu déroulant au clic extérieur ou sur Échap.
function useFermeture(ouvert: boolean, fermer: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) fermer(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
    document.addEventListener('mousedown', f);
    document.addEventListener('keydown', k, true);
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k, true); };
  }, [ouvert, fermer]);
  return ref;
}

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Liste Airtable d'une option (pour sa couleur), retrouvée d'après le tableau d'options.
const CLE = new Map<string[], string>([
  [O.POLES, 'POLES'], [O.ETATS_INTERNES, 'ETATS_INTERNES'], [O.CONTRATS, 'CONTRATS'], [O.MANAGERS, 'MANAGERS'], [O.CDPS, 'CDPS'],
  [O.MATERIAUX, 'MATERIAUX'], [O.REHAB_NEUF, 'REHAB_NEUF'], [O.PROG_PRINCIPAUX, 'PROG_PRINCIPAUX'], [O.PROG_SECONDAIRES, 'PROG_SECONDAIRES'],
]);

// Bulle colorée d'une option, comme dans Airtable.
function Bulle({ liste, texte, onRetirer }: { liste: string; texte: string; onRetirer?: () => void }) {
  return (
    <span className="ca-bulle" style={O.teinte(liste, texte)}>
      {texte}
      {onRetirer && <button type="button" aria-label={`Retirer ${texte}`} onClick={e => { e.stopPropagation(); onRetirer(); }}>×</button>}
    </span>
  );
}

const Coche = () => (
  <svg className="ca-coche" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
);

// Menu d'options : recherche « Rechercher une option », bulles, flèches + Entrée.
function MenuOptions({ liste, options, choisies, onBasculer }: { liste: string; options: string[]; choisies: string[]; onBasculer: (o: string) => void }) {
  const [q, setQ] = useState('');
  const [actif, setActif] = useState(0);
  const vues = options.filter(o => !q || sansAccent(o).includes(sansAccent(q)));
  useEffect(() => { setActif(0); }, [q]);
  const clavier = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActif(i => Math.min(i + 1, vues.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (vues[actif]) onBasculer(vues[actif]); }
  };
  return (
    <div className="ca-menu" onKeyDown={clavier}>
      <input autoFocus className="ca-filtre" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une option" />
      <div className="ca-menu-liste" role="listbox">
        {vues.map((o, i) => (
          <button type="button" role="option" aria-selected={choisies.includes(o)} key={o}
            className={`ca-opt ${i === actif ? 'actif' : ''}`} onMouseEnter={() => setActif(i)} onClick={() => onBasculer(o)}>
            <Bulle liste={liste} texte={o} />
            {choisies.includes(o) && <Coche />}
          </button>
        ))}
        {!vues.length && <div className="ca-vide">Aucune option</div>}
      </div>
    </div>
  );
}

// Liste déroulante à choix unique : la valeur s'affiche en bulle colorée.
function Liste({ valeur, options, onChange, libelle }: { valeur: string; options: string[]; onChange: (v: string) => void; libelle: string }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useFermeture(ouvert, () => setOuvert(false));
  const liste = CLE.get(options) || '';
  return (
    <div className="ca-multi" ref={ref}>
      <div role="button" tabIndex={0} className={`ca-declencheur ${ouvert ? 'ouvert' : ''}`} aria-label={libelle} aria-haspopup="listbox" aria-expanded={ouvert}
        onClick={() => setOuvert(o => !o)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); setOuvert(true); } }}>
        {valeur ? <Bulle liste={liste} texte={valeur} onRetirer={() => onChange('')} /> : <span className="ca-invite">Choisir…</span>}
        <span className="ca-chevron" aria-hidden="true" />
      </div>
      {ouvert && <MenuOptions liste={liste} options={options} choisies={valeur ? [valeur] : []} onBasculer={o => { onChange(o); setOuvert(false); }} />}
    </div>
  );
}

// Choix multiples : bulles colorées + bouton « + ».
function Multi({ valeurs, options, onChange, libelle }: { valeurs: string[]; options: string[]; onChange: (v: string[]) => void; libelle: string }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useFermeture(ouvert, () => setOuvert(false));
  const liste = CLE.get(options) || '';
  const basculer = (o: string) => onChange(valeurs.includes(o) ? valeurs.filter(x => x !== o) : [...valeurs, o]);
  return (
    <div className="ca-multi" ref={ref}>
      <div className={`ca-boite ${ouvert ? 'ouvert' : ''}`} onClick={e => { if (e.target === e.currentTarget) setOuvert(o => !o); }}>
        {valeurs.map(v => <Bulle key={v} liste={liste} texte={v} onRetirer={() => basculer(v)} />)}
        <button type="button" className="ca-plus" aria-label={`Ajouter : ${libelle}`} aria-expanded={ouvert} onClick={() => setOuvert(o => !o)}>+</button>
      </div>
      {ouvert && <MenuOptions liste={liste} options={options} choisies={valeurs} onBasculer={basculer} />}
    </div>
  );
}

// Liens vers des organisations du CRM : « + Ajouter dossier » ouvre une recherche
// présentée comme les fiches liées d'Airtable (nom, compétences, rôle commercial).
function Dossiers({ ids, orgs, onChange, libelle }: { ids: string[]; orgs: Organisation[] | null; onChange: (v: string[]) => void; libelle: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState('');
  const ref = useFermeture(ouvert, () => setOuvert(false));
  const parId = useMemo(() => new Map((orgs || []).map(o => [o.id, o])), [orgs]);
  const liste = useMemo(() => {
    const n = sansAccent(q.trim());
    return (orgs || []).filter(o => !ids.includes(o.id) && (!n || sansAccent(o.nom).includes(n))).slice(0, 40);
  }, [orgs, q, ids]);
  return (
    <div className="ca-multi" ref={ref}>
      <div className="ca-dossiers">
        {ids.map(id => (
          <span key={id} className="ca-dossier">{parId.get(id)?.nom || '…'}<button type="button" aria-label="Retirer" onClick={() => onChange(ids.filter(x => x !== id))}>×</button></span>
        ))}
        <button type="button" className="btn btn-sec btn-sm ca-ajout" aria-expanded={ouvert} onClick={() => { setOuvert(o => !o); setQ(''); }}>+ Ajouter dossier</button>
      </div>
      {ouvert && (
        <div className="ca-menu ca-menu-fiches">
          <input autoFocus className="ca-filtre" value={q} onChange={e => setQ(e.target.value)} placeholder={`Rechercher : ${libelle.toLowerCase()}`} />
          <div className="ca-menu-liste">
            {!orgs && <div className="ca-vide">Chargement du CRM…</div>}
            {liste.map(o => (
              <button type="button" key={o.id} className="ca-fiche" onClick={() => { onChange([...ids, o.id]); setOuvert(false); }}>
                <span className="ca-fiche-nom">{o.nom}</span>
                {(o.competences.length > 0 || o.roles.length > 0) && (
                  <span className="ca-fiche-champs">
                    <span><small>Compétences</small><span className="ca-bulles">{o.competences.map(c => <Bulle key={c} liste="CRM_COMPETENCES" texte={c} />)}</span></span>
                    <span><small>Rôle commercial</small><span className="ca-bulles">{o.roles.map(r => <Bulle key={r} liste="CRM_ROLES" texte={r} />)}</span></span>
                  </span>
                )}
              </button>
            ))}
            {orgs && !liste.length && <div className="ca-vide">Aucune organisation ne correspond.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Champ({ libelle, oblig, aide, children, large }: { libelle: string; oblig?: boolean; aide?: React.ReactNode; children: React.ReactNode; large?: boolean }) {
  return (
    <div className={`ca-champ ${large ? 'large' : ''}`}>
      <div className="ca-libelle">{libelle}{oblig && <span className="ca-oblig">*</span>}</div>
      {aide && <div className="ca-aide">{aide}</div>}
      {children}
    </div>
  );
}

export default function CreerAffaire({ moi, onFermer, onCree }: { moi: string; onFermer: () => void; onCree: (code: string) => void }) {
  const [a, setA] = useState<NouvelleAffaire>(() => vide(moi));
  const [orgs, setOrgs] = useState<Organisation[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = <K extends keyof NouvelleAffaire>(k: K, v: NouvelleAffaire[K]) => setA(x => ({ ...x, [k]: v }));
  const nombre = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\s/g, '').replace(',', '.')));

  useEffect(() => {
    fetch('/api/crm').then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.erreur); setOrgs(j.organisations); })
      .catch(e => setErr(`CRM indisponible : ${(e as Error).message}`));
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !envoi) onFermer(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [envoi, onFermer]);

  const apercu = [a.clef, a.codeMoa, a.codeAdresse].map(s => s.trim().toUpperCase()).filter(Boolean).join('_');
  const manque = !a.clef.trim() || !a.codeMoa.trim() || !a.codeAdresse.trim() || !a.pole;

  async function envoyer() {
    if (manque) { setErr('Renseigne les champs obligatoires : Clef, Code MOA/Pays, Code Adresse/Projet et Pôle.'); return; }
    for (const v of [a.surface, a.budgetHT, a.marchePI]) if (v !== null && (!Number.isFinite(v) || v < 0)) { setErr('Surface, Budget HT et Marché PI doivent être des nombres positifs.'); return; }
    setEnvoi(true); setErr(null);
    try {
      const r = await fetch('/api/affaires', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'creer', affaire: a }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`);
      onCree(j.code);
    } catch (e) { setErr((e as Error).message); setEnvoi(false); }
  }

  return (
    <div className="voile ca-voile" onMouseDown={() => !envoi && onFermer()}>
      <div className="ca-fenetre" role="dialog" aria-modal="true" aria-label="Créer une affaire" onMouseDown={e => e.stopPropagation()}>
        <div className="ca-tete">
          <div>
            <h2>Créer une affaire</h2>
            <div className="ca-apercu">{apercu ? <>Nom dans Airtable : <strong>{apercu}</strong></> : 'Table Affaire · Suivi administratif et financier'}</div>
          </div>
          <button className="ca-fermer" aria-label="Fermer" onClick={onFermer} disabled={envoi}>×</button>
        </div>

        <div className="ca-corps">
          <h3>Contractuel</h3>
          <div className="ca-grille g3">
            <Champ libelle="Clef" oblig aide="pour STR AXXXS pour ENV AXXXE">
              <input className="ca-input" value={a.clef} onChange={e => maj('clef', e.target.value)} autoFocus />
            </Champ>
            <Champ libelle="Code MOA/Pays" oblig aide="Indiquer le code MOA ex : SDC ou ACCOR">
              <input className="ca-input" value={a.codeMoa} onChange={e => maj('codeMoa', e.target.value)} />
            </Champ>
            <Champ libelle="Code Adresse/Projet" oblig aide="Indiqué le code adresse ex : 4RDBRETAGNE">
              <input className="ca-input" value={a.codeAdresse} onChange={e => maj('codeAdresse', e.target.value)} />
            </Champ>
            <Champ libelle="Pôle" oblig><Liste libelle="Pôle" valeur={a.pole} options={O.POLES} onChange={v => maj('pole', v)} /></Champ>
            <Champ libelle="Etat interne"><Liste libelle="Etat interne" valeur={a.etat} options={O.ETATS_INTERNES} onChange={v => maj('etat', v)} /></Champ>
            <Champ libelle="Contrat"><Liste libelle="Contrat" valeur={a.contrat} options={O.CONTRATS} onChange={v => maj('contrat', v)} /></Champ>
          </div>
          <div className="ca-grille g4">
            <Champ libelle="Architecte"><Dossiers libelle="Architecte" ids={a.architecte} orgs={orgs} onChange={v => maj('architecte', v)} /></Champ>
            <Champ libelle="Maître d'ouvrage"><Dossiers libelle="Maître d'ouvrage" ids={a.moa} orgs={orgs} onChange={v => maj('moa', v)} /></Champ>
            <Champ libelle="BET associés"><Dossiers libelle="BET" ids={a.bet} orgs={orgs} onChange={v => maj('bet', v)} /></Champ>
            <Champ libelle="Entreprise"><Dossiers libelle="Entreprise" ids={a.entreprise} orgs={orgs} onChange={v => maj('entreprise', v)} /></Champ>
          </div>
          <div className="ca-grille g3">
            <Champ libelle="Adresse"><textarea className="ca-input ca-zone" value={a.adresse} onChange={e => maj('adresse', e.target.value)} rows={3} /></Champ>
            <Champ libelle="Programmes principaux"><Multi libelle="Programmes principaux" valeurs={a.progPrincipaux} options={O.PROG_PRINCIPAUX} onChange={v => maj('progPrincipaux', v)} /></Champ>
            <Champ libelle="Programmes secondaires"><Multi libelle="Programmes secondaires" valeurs={a.progSecondaires} options={O.PROG_SECONDAIRES} onChange={v => maj('progSecondaires', v)} /></Champ>
          </div>
          <div className="ca-grille g2">
            <Champ libelle="Matériaux"><Multi libelle="Matériaux" valeurs={a.materiaux} options={O.MATERIAUX} onChange={v => maj('materiaux', v)} /></Champ>
            <Champ libelle="Rehab / Neuf"><Multi libelle="Rehab / Neuf" valeurs={a.rehabNeuf} options={O.REHAB_NEUF} onChange={v => maj('rehabNeuf', v)} /></Champ>
            <Champ libelle="Surface(m²)">
              <input className="ca-input" inputMode="decimal" value={a.surface ?? ''} onChange={e => maj('surface', nombre(e.target.value))} />
            </Champ>
            <Champ libelle="Budget HT">
              <div className="ca-unite"><input className="ca-input" inputMode="decimal" value={a.budgetHT ?? ''} onChange={e => maj('budgetHT', nombre(e.target.value))} /><span>€</span></div>
            </Champ>
          </div>

          <h3>Gestion de projet</h3>
          <div className="ca-grille g2">
            <Champ libelle="Manager"><Liste libelle="Manager" valeur={a.manager} options={O.MANAGERS} onChange={v => maj('manager', v)} /></Champ>
            <Champ libelle="CDP" aide="Chef.fe de Projet"><Multi libelle="CDP" valeurs={a.cdp} options={O.CDPS} onChange={v => maj('cdp', v)} /></Champ>
            <Champ large libelle="Marché PI" aide={<>Prestations intellectuelles d&apos;AI et des ST<br />PI AI + PI ST caché</>}>
              <div className="ca-unite"><input className="ca-input" inputMode="decimal" value={a.marchePI ?? ''} onChange={e => maj('marchePI', nombre(e.target.value))} /><span>€</span></div>
            </Champ>
          </div>

          <h3>Spécificité Chorus</h3>
          <div className="ca-grille g1">
            <Champ libelle="Spécificité facturation"><textarea className="ca-input ca-zone" rows={3} value={a.specFacturation} onChange={e => maj('specFacturation', e.target.value)} /></Champ>
          </div>
          <div className="ca-grille g4">
            <Champ libelle="A1, 2, 9 ou 12 et siret"><textarea className="ca-input ca-zone" rows={2} value={a.siret} onChange={e => maj('siret', e.target.value)} /></Champ>
            <Champ libelle="Code marché"><textarea className="ca-input ca-zone" rows={2} value={a.codeMarche} onChange={e => maj('codeMarche', e.target.value)} /></Champ>
            <Champ libelle="Code service"><textarea className="ca-input ca-zone" rows={2} value={a.codeService} onChange={e => maj('codeService', e.target.value)} /></Champ>
            <Champ libelle="N° d'engagement"><textarea className="ca-input ca-zone" rows={2} value={a.engagement} onChange={e => maj('engagement', e.target.value)} /></Champ>
          </div>
        </div>

        {err && <div className="bandeau err ca-err">{err}</div>}
        <div className="ca-pied">
          <span className="discret">* champs obligatoires</span>
          <button className="btn btn-sec" onClick={onFermer} disabled={envoi}>Annuler</button>
          <button className="btn btn-pri" onClick={envoyer} disabled={envoi}>{envoi ? 'Envoi…' : 'Envoyer'}</button>
        </div>
      </div>
    </div>
  );
}

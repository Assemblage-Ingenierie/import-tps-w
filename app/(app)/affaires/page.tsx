'use client';
// « Mes affaires » : affaires dont je suis Chef·fe de projet (CDP) ou Manager
// dans Airtable, réparties en cours / terminées selon « Etat interne ».
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { AffaireLite, AffaireMienne } from '@/lib/types';
import SelecteurAffaire from '@/components/SelecteurAffaire';
import { couleurAffaire, couleursDuMois } from '@/components/couleurs';

const nb = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
// États proposés (options de « Etat interne »), dans l'ordre de vie d'une affaire.
const ETATS = ['AO', 'Etude', 'Chantier', 'En Cours', 'Livré', 'Terminé', 'Annulé', 'Interrompu'];
const eur = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString('fr-FR') + ' €');

// Teinte de la pastille d'état : actif (indigo), chantier (vert), AO (ambre), clos (gris).
function classeEtat(etat: string): string {
  if (etat === 'Chantier') return 'etat-chantier';
  if (etat === 'AO') return 'etat-ao';
  if (['Etude', 'En Cours'].includes(etat)) return 'etat-actif';
  return 'etat-clos';
}

// Menu « ⋯ » d'une ligne : se ferme au clic à l'extérieur ou sur Échap.
function MenuLigne({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', f);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); };
  }, [ouvert]);
  return (
    <div className="ma-menu" ref={ref}>
      <button className="ma-plus" aria-label="Plus d’actions" aria-expanded={ouvert} onClick={() => setOuvert(o => !o)}>⋯</button>
      {ouvert && <div className="ma-menu-liste" onClick={() => setOuvert(false)}>{children}</div>}
    </div>
  );
}

function MesAffaires() {
  const params = useSearchParams();
  const vue = params.get('vue') === 'terminees' ? 'terminees' : 'en-cours';
  const [d, setD] = useState<{ mes: AffaireMienne[]; affaires: AffaireLite[]; exercice: string; balanceVisible: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [ajout, setAjout] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = (frais = false) =>
    fetch(`/api/affaires?mes=1${frais ? '&frais=1' : ''}`).then(async r => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur || 'Erreur');
      setD(j);
    }).catch(e => setErr(e.message));
  useEffect(() => { charger(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Action sur une affaire puis rechargement sans cache.
  async function agir(affaireId: string, corps: Record<string, unknown>, message: string) {
    setEnCours(affaireId); setErr(null); setInfo(null);
    try {
      const r = await fetch('/api/affaires', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ affaireId, ...corps }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`);
      await charger(true);
      setInfo(message);
    } catch (e) { setErr((e as Error).message); } finally { setEnCours(null); }
  }

  const nbEnCours = (d?.mes || []).filter(a => !a.clos).length;
  const nbTerminees = (d?.mes || []).filter(a => a.clos).length;
  const totalJours = (d?.mes || []).reduce((s, a) => s + a.joursExercice, 0);

  const liste = useMemo(() => (d?.mes || [])
    .filter(a => (vue === 'terminees' ? a.clos : !a.clos))
    .filter(a => !q || `${a.code} ${a.nom}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.joursExercice - a.joursExercice || a.code.localeCompare(b.code, 'fr')), [d, vue, q]);
  const maxJours = Math.max(1, ...liste.map(a => a.joursExercice));

  // Une couleur distincte par affaire affichée (la plus travaillée en premier), comme dans la saisie.
  const couleurs = useMemo(() => couleursDuMois(
    new Map(liste.map(a => [a.id, a.joursExercice] as [string, number])),
    new Map(liste.map(a => [a.id, a] as [string, AffaireMienne])),
  ), [liste]);

  return (
    <div className="mes-affaires">
      <div className="ma-tete">
        <h1>Mes affaires</h1>
        {d && <span className="discret">{nbEnCours} en cours · {nb(totalJours)} j saisis en {d.exercice}</span>}
        <button className="btn btn-pri" disabled={!d} onClick={() => setAjout(true)}>+ Ajouter une affaire</button>
      </div>
      <div className="onglets ma-onglets">
        <Link className={vue === 'en-cours' ? 'actif' : ''} href="/affaires?vue=en-cours" replace>En cours {d && <span className="ma-compte">{nbEnCours}</span>}</Link>
        <Link className={vue === 'terminees' ? 'actif' : ''} href="/affaires?vue=terminees" replace>Terminées {d && <span className="ma-compte">{nbTerminees}</span>}</Link>
        <input className="recherche ma-recherche" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" title="Affaires dont tu es Chef·fe de projet ou Manager dans Airtable" />
      </div>
      {err && <div className="bandeau err">{err}</div>}
      {info && <div className="bandeau ok">{info} <button className="lien" onClick={() => setInfo(null)}>fermer</button></div>}
      {!d && !err && <div className="chargement">Chargement…</div>}
      {d && (
        <div className={`ma-carte ${d.balanceVisible ? 'avec-renta' : ''}`}>
          <div className="ma-ligne ma-entete">
            <span>Affaire</span><span>État</span><span>Mes jours {d.exercice}</span>
            {d.balanceVisible && <span className="num">Rentabilité</span>}
            <span />
          </div>
          {liste.map(a => {
            const clos = vue === 'terminees';
            const cdp = a.role.includes('Chef·fe de projet');
            return (
              <div className={`ma-ligne ${clos ? 'close' : ''}`} key={a.id}>
                <div className="ma-affaire">
                  <div>
                    <span className="pastille" style={{ background: clos ? '#9CA3AF' : (couleurs.get(a.id) ?? couleurAffaire(a)) }} />
                    <span className="ma-code">{a.code}</span>
                    {a.pole && <span className="ma-etiquette">{a.pole}</span>}
                    {cdp && <span className="ma-etiquette" title="Chef·fe de projet">CDP</span>}
                    {a.role.includes('Manager') && <span className="ma-etiquette">Manager</span>}
                  </div>
                  <div className="ma-nom" title={a.nom}>{a.nom}</div>
                </div>
                <div>
                  {a.gerable
                    ? <select className={`etat-pastille ${classeEtat(a.etat)}`} value={a.etat} disabled={enCours === a.id} aria-label={`État de ${a.code}`}
                        onChange={e => agir(a.id, { action: 'etat', etat: e.target.value }, `${a.code} : état passé à « ${e.target.value} ».`)}>
                        {!ETATS.includes(a.etat) && <option value={a.etat}>{a.etat || '—'}</option>}
                        {ETATS.map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                    : <span className={`etat-pastille ${classeEtat(a.etat)}`}>{a.etat || '—'}</span>}
                </div>
                <div className="ma-jours">
                  <div>{nb(a.joursExercice)} j</div>
                  <div className="ma-barre"><span style={{ width: `${(100 * a.joursExercice) / maxJours}%` }} /></div>
                </div>
                {d.balanceVisible && <span className="num">{eur(a.balance)}</span>}
                <div className="ma-actions">
                  {clos
                    ? (a.gerable && <button className="btn btn-sec btn-sm ma-action" disabled={enCours === a.id} onClick={() => agir(a.id, { action: 'etat', etat: 'En Cours' }, `${a.code} rouverte : elle repasse dans « En cours ».`)}>Rouvrir</button>)
                    : <Link className="btn btn-sec btn-sm ma-action" href="/saisie">Saisir</Link>}
                  {cdp && (
                    <MenuLigne>
                      <button disabled={enCours === a.id} onClick={() => { if (confirm(`Te retirer des Chef·fe·s de projet de ${a.code} ? Les autres CDP de l’affaire sont conservés.`)) agir(a.id, { action: 'cdp', ajouter: false }, `Tu n’es plus Chef·fe de projet de ${a.code} : l’affaire est retirée de tes affaires.`); }}>
                        Me retirer des CDP
                      </button>
                    </MenuLigne>
                  )}
                </div>
              </div>
            );
          })}
          {!liste.length && <div className="ma-vide">{q ? 'Aucune affaire ne correspond à la recherche.' : clos0(vue)}</div>}
        </div>
      )}
      {ajout && d && (
        <SelecteurAffaire modeAjout affaires={d.affaires.filter(a => !a.horsAffaire && !d.mes.some(m => m.id === a.id))} mesIds={new Set()} recentes={[]} nbCreneaux={0}
          onFermer={() => setAjout(false)}
          onChoisir={a => { setAjout(false); if (a) agir(a.id, { action: 'cdp', ajouter: true }, `Tu es maintenant Chef·fe de projet de ${a.code}.`); }} />
      )}
    </div>
  );
}

const clos0 = (vue: string) => (vue === 'terminees' ? 'Aucune affaire terminée.' : 'Aucune affaire en cours : ajoute-toi sur une affaire avec « + Ajouter une affaire ».');

export default function PageAffaires() {
  return <Suspense fallback={<div className="chargement">Chargement…</div>}><MesAffaires /></Suspense>;
}

'use client';
// « Mes affaires » : affaires dont je suis Chef·fe de projet (CDP) ou Manager
// dans Airtable, réparties en cours / terminées selon « Etat interne ».
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { AffaireLite, AffaireMienne } from '@/lib/types';
import SelecteurAffaire from '@/components/SelecteurAffaire';
import { couleurAffaire, couleursDuMois } from '@/components/couleurs';

const nb = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
// États proposés (options de « Etat interne »), dans l'ordre de vie d'une affaire.
const ETATS = ['AO', 'Etude', 'Chantier', 'En Cours', 'Livré', 'Terminé', 'Annulé', 'Interrompu'];
const eur = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString('fr-FR') + ' €');

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


  const liste = useMemo(() => (d?.mes || [])
    .filter(a => (vue === 'terminees' ? a.clos : !a.clos))
    .filter(a => !q || `${a.code} ${a.nom}`.toLowerCase().includes(q.toLowerCase())), [d, vue, q]);

  // Une couleur distincte par affaire affichée (la plus travaillée en premier), comme dans la saisie.
  const couleurs = useMemo(() => couleursDuMois(
    new Map(liste.map(a => [a.id, a.joursExercice] as [string, number])),
    new Map(liste.map(a => [a.id, a] as [string, AffaireMienne])),
  ), [liste]);

  return (
    <div>
      <h1>Mes affaires</h1>
      <div className="onglets">
        <Link className={vue === 'en-cours' ? 'actif' : ''} href="/affaires?vue=en-cours" replace>En cours</Link>
        <Link className={vue === 'terminees' ? 'actif' : ''} href="/affaires?vue=terminees" replace>Terminées</Link>
      </div>
      <p className="discret">Affaires dont tu es Chef·fe de projet ou Manager dans Airtable. « Terminées » : état Terminé, Annulé, Interrompu ou Livré.</p>
      <div className="affaires-barre">
        <input className="recherche" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" />
        <button className="btn btn-pri" disabled={!d} onClick={() => setAjout(true)}>+ Ajouter une affaire</button>
      </div>
      {err && <div className="bandeau err">{err}</div>}
      {info && <div className="bandeau ok">{info} <button className="lien" onClick={() => setInfo(null)}>fermer</button></div>}
      {!d && !err && <div className="chargement">Chargement…</div>}
      {d && (
        <div className="tableau-wrap">
          <table className="tableau">
            <thead><tr>
              <th>Code</th><th>Affaire</th><th>Pôle</th><th>État</th><th>Rôle</th><th className="num">Mes jours {d.exercice}</th>
              {d.balanceVisible && <><th className="num">Rentabilité globale</th></>}
              <th></th>
            </tr></thead>
            <tbody>
              {liste.map(a => (
                <tr key={a.id}>
                  <td className="nom"><span className="pastille" style={{ background: couleurs.get(a.id) ?? couleurAffaire(a) }} /> {a.code}</td>
                  <td>{a.nom}</td><td>{a.pole || '—'}</td>
                  <td>{a.gerable
                    ? <select className="etat-select" value={a.etat} disabled={enCours === a.id} onChange={e => agir(a.id, { action: 'etat', etat: e.target.value }, `${a.code} : état passé à « ${e.target.value} ».`)}>
                        {!ETATS.includes(a.etat) && <option value={a.etat}>{a.etat || '—'}</option>}
                        {ETATS.map(x => <option key={x} value={x}>{x}</option>)}
                      </select>
                    : (a.etat || '—')}</td>
                  <td>{a.role}</td>
                  <td className="num">{nb(a.joursExercice)} j</td>
                  {d.balanceVisible && <>
                    <td className="num">{eur(a.balance)}</td>
                  </>}
                  <td className="affaire-actions">
                    {vue === 'terminees' && a.gerable && <button className="lien" disabled={enCours === a.id} onClick={() => agir(a.id, { action: 'etat', etat: 'En Cours' }, `${a.code} rouverte : elle repasse dans « En cours ».`)}>Rouvrir</button>}
                    {vue === 'en-cours' && <Link href="/saisie">Saisir</Link>}
                    {a.role.includes('Chef·fe de projet') && <button className="lien discret-lien" disabled={enCours === a.id} onClick={() => { if (confirm(`Te retirer des Chef·fe·s de projet de ${a.code} ? Les autres CDP de l’affaire sont conservés.`)) agir(a.id, { action: 'cdp', ajouter: false }, `Tu n’es plus Chef·fe de projet de ${a.code} : l’affaire est retirée de tes affaires.`); }}>Me retirer des CDP</button>}
                  </td>
                </tr>
              ))}
              {!liste.length && <tr><td colSpan={9} className="discret">Aucune affaire.</td></tr>}
            </tbody>
          </table>
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

export default function PageAffaires() {
  return <Suspense fallback={<div className="chargement">Chargement…</div>}><MesAffaires /></Suspense>;
}

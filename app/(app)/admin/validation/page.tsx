'use client';
// Validation mensuelle (Admin) : collaborateurs × statut du mois.
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LigneValidation, Statut } from '@/lib/types';
import { aujourdhuiParis, moisDecale, frMois } from '@/lib/dates';

const nb = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
const CLASSE: Record<Statut, string> = { 'A compléter': 'brouillon', 'En attente de validation': 'attente', 'Validée': 'valide', 'Refusée': 'refuse' };

function Validation() {
  const router = useRouter();
  const params = useSearchParams();
  const ym = params.get('ym') || moisDecale(aujourdhuiParis().slice(0, 7), 0);
  const [lignes, setLignes] = useState<LigneValidation[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Statut | ''>('');
  const [enCours, setEnCours] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());

  async function charger() {
    setLignes(null); setErr(null); setSel(new Set());
    try {
      const r = await fetch(`/api/admin/validation?ym=${ym}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.erreur);
      setLignes(d.lignes);
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { charger(); }, [ym]); // eslint-disable-line react-hooks/exhaustive-deps

  async function validerSelection() {
    setEnCours(true); setErr(null);
    const r = await fetch('/api/admin/validation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ym, prenoms: [...sel] }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.erreur || `Erreur ${r.status}`); }
    setEnCours(false); charger();
  }

  const visibles = (lignes || []).filter(l => !filtre || l.statut === filtre);
  return (
    <div>
      <h1>Validation mensuelle</h1>
      <div className="barre-mois">
        <button className="fleche" aria-label="Mois précédent" onClick={() => router.replace(`?ym=${moisDecale(ym, -1)}`)}>‹</button>
        <button className="fleche" aria-label="Mois suivant" onClick={() => router.replace(`?ym=${moisDecale(ym, 1)}`)}>›</button>
        <h2>{frMois(ym).replace(/^./, x => x.toUpperCase())}</h2>
        <span className="espace" />
        <select value={filtre} onChange={e => setFiltre(e.target.value as Statut | '')}>
          <option value="">Tous les statuts</option>
          {Object.keys(CLASSE).map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-pri" disabled={!sel.size || enCours} onClick={validerSelection}>Valider la sélection ({sel.size})</button>
      </div>
      {err && <div className="bandeau err">{err}</div>}
      {!lignes && !err && <div className="chargement">Chargement…</div>}
      {lignes && (
        <div className="tableau-wrap">
          <table className="tableau">
            <thead><tr>
              <th></th><th>Collaborateur</th><th>Statut</th><th className="num">Complétude</th>
              <th className="num" title="Temps saisi sur un créneau d'absence Payfit">Pendant absence</th>
              <th className="num" title="Saisies sur une affaire clôturée">Affaires clôturées</th>
              <th className="num" title="Saisies un jour non ouvré confirmées">Jours non ouvrés</th><th></th>
            </tr></thead>
            <tbody>
              {visibles.map(l => (
                <tr key={l.cle}>
                  <td>{l.statut === 'En attente de validation' && (
                    <input type="checkbox" checked={sel.has(l.prenom)} onChange={() => setSel(s => { const n = new Set(s); if (n.has(l.prenom)) n.delete(l.prenom); else n.add(l.prenom); return n; })} />
                  )}</td>
                  <td className="nom">{l.prenom} {l.nom}{!l.email && <span className="discret" title="Champ Email vide dans la fiche Collaborateur"> · email ?</span>}</td>
                  <td><span className={`statut ${CLASSE[l.statut]}`}>{l.statut}</span>{l.soumisLe && <small className="discret"> {new Date(l.soumisLe).toLocaleDateString('fr-FR')}</small>}</td>
                  <td className={`num ${l.couverts < l.attendus ? 'alerte' : ''}`}>{nb(l.couverts / 2)} / {nb(l.attendus / 2)} j</td>
                  <td className={`num ${l.conflits ? 'alerte' : ''}`}>{l.conflits || '—'}</td>
                  <td className={`num ${l.clotureesMaintenues ? 'alerte' : ''}`}>{l.clotureesMaintenues || '—'}</td>
                  <td className="num">{l.nonOuvresConfirmes || '—'}</td>
                  <td><Link href={`/admin/collaborateur?prenom=${encodeURIComponent(l.prenom)}&ym=${ym}`}>Ouvrir</Link></td>
                </tr>
              ))}
              {!visibles.length && <tr><td colSpan={8} className="discret">Aucun collaborateur.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PageValidation() {
  return <Suspense fallback={<div className="chargement">Chargement…</div>}><Validation /></Suspense>;
}

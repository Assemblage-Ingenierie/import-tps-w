'use client';
// « Mes affaires » : affaires dont je suis Chef·fe de projet (CDP) ou Manager
// dans Airtable, réparties en cours / terminées selon « Etat interne ».
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { AffaireMienne } from '@/lib/types';
import { couleurAffaire } from '@/components/couleurs';

const nb = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
const eur = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString('fr-FR') + ' €');

function MesAffaires() {
  const params = useSearchParams();
  const vue = params.get('vue') === 'terminees' ? 'terminees' : 'en-cours';
  const [d, setD] = useState<{ mes: AffaireMienne[]; exercice: string; balanceVisible: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/affaires?mes=1').then(async r => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.erreur || 'Erreur');
      setD(j);
    }).catch(e => setErr(e.message));
  }, []);

  const liste = useMemo(() => (d?.mes || [])
    .filter(a => (vue === 'terminees' ? a.clos : !a.clos))
    .filter(a => !q || `${a.code} ${a.nom}`.toLowerCase().includes(q.toLowerCase())), [d, vue, q]);

  return (
    <div>
      <h1>{vue === 'terminees' ? 'Mes affaires terminées' : 'Mes affaires en cours'}</h1>
      <p className="discret">Affaires dont tu es Chef·fe de projet ou Manager dans Airtable. « Terminées » : état Terminé, Annulé, Interrompu ou Livré.</p>
      <input className="recherche" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" />
      {err && <div className="bandeau err">{err}</div>}
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
                  <td className="nom"><span className="pastille" style={{ background: couleurAffaire(a) }} /> {a.code}</td>
                  <td>{a.nom}</td><td>{a.pole || '—'}</td><td>{a.etat || '—'}</td><td>{a.role}</td>
                  <td className="num">{nb(a.joursExercice)} j</td>
                  {d.balanceVisible && <>
                    <td className="num">{eur(a.balance)}</td>
                  </>}
                  <td><Link href="/saisie">Saisir</Link></td>
                </tr>
              ))}
              {!liste.length && <tr><td colSpan={9} className="discret">Aucune affaire.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PageAffaires() {
  return <Suspense fallback={<div className="chargement">Chargement…</div>}><MesAffaires /></Suspense>;
}

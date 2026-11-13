'use client';
// Balances (Admin) : par affaire et par collaborateur. Document interne.
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { LigneBalance } from '@/lib/types';

const nb = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
const eur = (v: number | null) => (v == null ? '—' : Math.round(v).toLocaleString('fr-FR') + ' €');

export default function PageBalances() {
  const [d, setD] = useState<{ exercice: string; libelleCout: string; lignes: LigneBalance[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [mode, setMode] = useState<'affaire' | 'collab'>('affaire');

  useEffect(() => {
    fetch('/api/admin/balances').then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.erreur); setD(j); }).catch(e => setErr(e.message));
  }, []);

  const lignes = useMemo(() => (d?.lignes || [])
    .filter(l => !q || `${l.code} ${l.nom}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.balance ?? Infinity) - (b.balance ?? Infinity)), [d, q]);

  const parCollab = useMemo(() => {
    const m = new Map<string, { prenom: string; jours: number; affaires: { code: string; nom: string; jours: number; balanceJours: number | null }[] }>();
    for (const l of d?.lignes || []) for (const p of l.parCollab) {
      const x = m.get(p.prenom) || { prenom: p.prenom, jours: 0, affaires: [] };
      x.jours += p.jours; x.affaires.push({ code: l.code, nom: l.nom, jours: p.jours, balanceJours: p.balanceJours });
      m.set(p.prenom, x);
    }
    return [...m.values()].sort((a, b) => a.prenom.localeCompare(b.prenom, 'fr'));
  }, [d]);

  return (
    <div>
      <h1>Balances</h1>
      <div className="interne">🔒 Document interne : montants issus d&apos;Airtable. Balance = « Marché PI » − « {d?.libelleCout || 'coût consommé'} ». Balance en jours = balance ÷ coût journalier du collaborateur.</div>
      <div className="onglets">
        <button className={mode === 'affaire' ? 'actif' : ''} onClick={() => setMode('affaire')}>Par affaire</button>
        <button className={mode === 'collab' ? 'actif' : ''} onClick={() => setMode('collab')}>Par collaborateur</button>
      </div>
      {err && <div className="bandeau err">{err}</div>}
      {!d && !err && <div className="chargement">Chargement…</div>}
      {d && mode === 'affaire' && <>
        <input className="recherche" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une affaire…" />
        <div className="tableau-wrap">
          <table className="tableau">
            <thead><tr><th>Code</th><th>Affaire</th><th>Pôle</th><th>État</th><th className="num">Marché PI</th><th className="num">{d.libelleCout}</th><th className="num">Balance</th><th className="num">Jours {d.exercice}</th></tr></thead>
            <tbody>
              {lignes.map(l => (
                <Fragment key={l.id}>
                  <tr className="cliquable" onClick={() => setOuvert(o => (o === l.id ? null : l.id))}>
                    <td className="nom">{l.parCollab.length ? (ouvert === l.id ? '▾ ' : '▸ ') : ''}{l.code}</td><td>{l.nom}</td><td>{l.pole}</td><td>{l.etat || '—'}</td>
                    <td className="num">{eur(l.marchePI)}</td><td className="num">{eur(l.coutConsomme)}</td>
                    <td className={`num ${l.balance != null && l.balance < 0 ? 'negatif' : ''}`}>{eur(l.balance)}</td>
                    <td className="num">{nb(l.parCollab.reduce((s, p) => s + p.jours, 0))} j</td>
                  </tr>
                  {ouvert === l.id && l.parCollab.map(p => (
                    <tr key={l.id + p.prenom} className="sous-ligne">
                      <td></td><td colSpan={3}>{p.prenom}</td><td></td>
                      <td className="num">{p.cout != null ? `${eur(p.cout)}/j` : '—'}</td>
                      <td className="num">{p.balanceJours == null ? '—' : `${nb(p.balanceJours)} j de ${p.prenom}`}</td>
                      <td className="num">{nb(p.jours)} j</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </>}
      {d && mode === 'collab' && (
        <div className="tableau-wrap">
          <table className="tableau">
            <thead><tr><th>Collaborateur</th><th>Affaire</th><th className="num">Jours {d.exercice}</th><th className="num">Balance en jours du collaborateur</th></tr></thead>
            <tbody>
              {parCollab.map(c => c.affaires.sort((a, b) => b.jours - a.jours).map((a, i) => (
                <tr key={c.prenom + a.code}>
                  <td className="nom">{i === 0 ? `${c.prenom} (${nb(c.jours)} j)` : ''}</td>
                  <td>{a.code} — {a.nom}</td><td className="num">{nb(a.jours)} j</td>
                  <td className={`num ${a.balanceJours != null && a.balanceJours < 0 ? 'negatif' : ''}`}>{a.balanceJours == null ? '—' : `${nb(a.balanceJours)} j`}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';
// Balances (Admin), par affaire, avec filtres Pôle / État / CDP. Document interne.
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { LigneBalance } from '@/lib/types';
import FiltreMulti from '@/components/FiltreMulti';

const nb = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
const eur = (v: number | null) => (v == null ? '—' : Math.round(v).toLocaleString('fr-FR') + ' €');

// Filtres mémorisés dans ce navigateur.
type Filtres = { pole: Set<string>; etat: Set<string>; cdp: Set<string> };
const CLE = 'tpsw_balances_filtres';
const vide = (): Filtres => ({ pole: new Set(), etat: new Set(), cdp: new Set() });
function lireFiltres(): Filtres {
  try {
    const x = JSON.parse(localStorage.getItem(CLE) || '{}');
    return { pole: new Set(x.pole || []), etat: new Set(x.etat || []), cdp: new Set(x.cdp || []) };
  } catch { return vide(); }
}
const unique = (l: string[]) => [...new Set(l.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));

export default function PageBalances() {
  const [d, setD] = useState<{ exercice: string; libelles: { globale: string; exercice: string }; lignes: LigneBalance[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [filtres, setFiltres] = useState<Filtres>(vide);

  useEffect(() => {
    setFiltres(lireFiltres());
    fetch('/api/admin/balances').then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.erreur); setD(j); }).catch(e => setErr(e.message));
  }, []);

  const changer = (cle: keyof Filtres, v: Set<string>) => {
    const n = { ...filtres, [cle]: v };
    setFiltres(n);
    try { localStorage.setItem(CLE, JSON.stringify({ pole: [...n.pole], etat: [...n.etat], cdp: [...n.cdp] })); } catch { /* stockage indisponible */ }
  };

  const options = useMemo(() => ({
    pole: unique((d?.lignes || []).map(l => l.pole)),
    etat: unique((d?.lignes || []).map(l => l.etat)),
    cdp: unique((d?.lignes || []).flatMap(l => l.cdp)),
  }), [d]);

  const lignes = useMemo(() => (d?.lignes || [])
    .filter(l => !q || `${l.code} ${l.nom}`.toLowerCase().includes(q.toLowerCase()))
    .filter(l => !filtres.pole.size || filtres.pole.has(l.pole))
    .filter(l => !filtres.etat.size || filtres.etat.has(l.etat))
    .filter(l => !filtres.cdp.size || l.cdp.some(c => filtres.cdp.has(c)))
    .sort((a, b) => (a.rentaGlobale ?? Infinity) - (b.rentaGlobale ?? Infinity)), [d, q, filtres]);

  const actifs = filtres.pole.size + filtres.etat.size + filtres.cdp.size > 0 || !!q;

  return (
    <div>
      <h1>Balances</h1>
      <div className="interne">🔒 Document interne : « Rentabilité globale » et « Rentabilité 25/26 » sont les formules Airtable, affichées telles quelles.</div>
      {err && <div className="bandeau err">{err}</div>}
      {!d && !err && <div className="chargement">Chargement…</div>}
      {d && <>
        <div className="filtres-barre">
          <input className="recherche" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une affaire…" />
          <FiltreMulti libelle="Pôle" options={options.pole} valeurs={filtres.pole} onChange={v => changer('pole', v)} />
          <FiltreMulti libelle="État" options={options.etat} valeurs={filtres.etat} onChange={v => changer('etat', v)} />
          <FiltreMulti libelle="CDP" options={options.cdp} valeurs={filtres.cdp} onChange={v => changer('cdp', v)} />
          {actifs && <button className="lien" onClick={() => { setQ(''); changer('pole', new Set()); setFiltres(vide()); try { localStorage.removeItem(CLE); } catch { /* */ } }}>Réinitialiser</button>}
          <span className="discret filtres-nb">{lignes.length} affaire{lignes.length > 1 ? 's' : ''}</span>
        </div>
        <div className="tableau-wrap">
          <table className="tableau">
            <thead><tr><th>Code</th><th>Affaire</th><th>Pôle</th><th>État</th><th>CDP</th><th className="num">Marché PI</th><th className="num">{d.libelles.globale}</th><th className="num">{d.libelles.exercice}</th><th className="num" title="Temps saisi sur l'affaire depuis le début de l'exercice, tous collaborateurs confondus">Temps saisi {d.exercice}</th></tr></thead>
            <tbody>
              {lignes.map(l => (
                <Fragment key={l.id}>
                  <tr className="cliquable" onClick={() => setOuvert(o => (o === l.id ? null : l.id))}>
                    <td className="nom"><span className="chevron-ligne">{l.parCollab.length ? (ouvert === l.id ? '▾' : '▸') : ''}</span>{l.code}</td><td>{l.nom}</td><td>{l.pole}</td><td>{l.etat || '—'}</td>
                    <td className="discret">{l.cdp.join(', ') || '—'}</td>
                    <td className="num">{eur(l.marchePI)}</td>
                    <td className="num">{eur(l.rentaGlobale)}</td>
                    <td className="num">{eur(l.rentaExercice)}</td>
                    <td className="num">{nb(l.parCollab.reduce((s, p) => s + p.jours, 0))} j</td>
                  </tr>
                  {ouvert === l.id && l.parCollab.map(p => (
                    <tr key={l.id + p.prenom} className="sous-ligne">
                      <td></td><td colSpan={4}>{p.prenom}{p.cout != null && <span className="discret"> · {eur(p.cout)}/j</span>}</td>
                      <td></td><td></td><td></td>
                      <td className="num">{nb(p.jours)} j</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {!lignes.length && <tr><td colSpan={9} className="discret">Aucune affaire ne correspond aux filtres.</td></tr>}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  );
}

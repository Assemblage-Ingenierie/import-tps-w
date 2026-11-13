'use client';
// Filtre à choix multiples, présenté comme dans Airtable :
// bouton « Pôle est STR ou ENV ▾ » qui ouvre une liste de cases à cocher.
import { useEffect, useRef, useState } from 'react';

export default function FiltreMulti({ libelle, options, valeurs, onChange }: {
  libelle: string;
  options: string[];
  valeurs: Set<string>;
  onChange: (v: Set<string>) => void;
}) {
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

  const choisis = options.filter(o => valeurs.has(o));
  const basculer = (o: string) => { const n = new Set(valeurs); if (n.has(o)) n.delete(o); else n.add(o); onChange(n); };

  return (
    <div className="filtre" ref={ref}>
      <button type="button" className={`filtre-bouton ${choisis.length ? 'actif' : ''}`} aria-expanded={ouvert} onClick={() => setOuvert(o => !o)}>
        {libelle}
        {choisis.length > 0 && <> est {choisis.map((c, i) => (
          <span key={c}>{i > 0 && <span className="filtre-ou"> ou </span>}<span className="filtre-puce">{c}</span></span>
        ))}</>}
        <span className="chevron">▾</span>
      </button>
      {ouvert && (
        <div className="filtre-liste" role="listbox" aria-multiselectable>
          {options.map(o => (
            <label key={o} className="filtre-option">
              <input type="checkbox" checked={valeurs.has(o)} onChange={() => basculer(o)} /> {o}
            </label>
          ))}
          {choisis.length > 0 && <button type="button" className="lien filtre-vider" onClick={() => onChange(new Set())}>Tout désélectionner</button>}
        </div>
      )}
    </div>
  );
}

'use client';
// Sélecteur d'affaire avec recherche. Ordre : mes affaires en cours, récentes,
// hors affaire, toutes les affaires en cours ; les clôturées dans une section
// repliée (leur choix déclenche la confirmation « affaire clôturée »).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AffaireLite } from '@/lib/types';
import { couleurAffaire } from './couleurs';

interface Props {
  affaires: AffaireLite[];
  mesIds: Set<string>;
  recentes: string[];
  nbCreneaux: number;
  onChoisir: (a: AffaireLite | null) => void;
  onFermer: () => void;
}

function normal(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function SelecteurAffaire({ affaires, mesIds, recentes, nbCreneaux, onChoisir, onFermer }: Props) {
  const [q, setQ] = useState('');
  const [voirClos, setVoirClos] = useState(false);
  const [actif, setActif] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const sections = useMemo(() => {
    const n = normal(q.trim());
    const ok = (a: AffaireLite) => !n || normal(`${a.code} ${a.nom}`).includes(n);
    const parId = new Map(affaires.map(a => [a.id, a]));
    const vus = new Set<string>();
    const prendre = (l: AffaireLite[]) => l.filter(a => ok(a) && !vus.has(a.id) && (vus.add(a.id), true));
    const ouvertes = affaires.filter(a => !a.clos);
    // Ordre : mes affaires en cours, mes affaires terminées (saisie soumise à
    // confirmation), codes hors affaire, récentes, autres affaires en cours.
    const s: { titre: string; items: AffaireLite[] }[] = [
      { titre: 'Mes affaires en cours', items: prendre(ouvertes.filter(a => mesIds.has(a.id) && !a.horsAffaire)) },
      { titre: 'Mes affaires terminées', items: prendre(affaires.filter(a => a.clos && mesIds.has(a.id) && !a.horsAffaire)) },
      { titre: 'Hors affaire', items: prendre(ouvertes.filter(a => a.horsAffaire)) },
      { titre: 'Récentes', items: prendre(recentes.map(id => parId.get(id)).filter((a): a is AffaireLite => !!a && !a.clos)) },
      { titre: 'Autres affaires', items: prendre(ouvertes) },
    ];
    const clos = affaires.filter(a => a.clos && ok(a) && !vus.has(a.id));
    return { s: s.filter(x => x.items.length), clos };
  }, [affaires, mesIds, recentes, q]);

  const aplat = [...sections.s.flatMap(x => x.items), ...(voirClos || q ? sections.clos : [])];
  useEffect(() => { setActif(0); }, [q, voirClos]);

  function clavier(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onFermer(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActif(i => Math.min(i + 1, aplat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (aplat[actif]) onChoisir(aplat[actif]); }
  }
  useEffect(() => {
    document.querySelector('.selecteur .option.actif')?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  const indexDe = new Map(aplat.map((a, n) => [a.id, n]));
  const ligne = (a: AffaireLite) => {
    const idx = indexDe.get(a.id) ?? -1;
    return (
      <button key={a.id} className={`option ${idx === actif ? 'actif' : ''} ${a.clos ? 'clos' : ''}`}
        onMouseEnter={() => setActif(idx)} onClick={() => onChoisir(a)}>
        <span className="pastille" style={{ background: couleurAffaire(a) }} />
        <span className="code">{a.code}</span>
        <span className="nom">{a.nom}</span>
        {a.clos && <span className="etat">{a.etat}</span>}
      </button>
    );
  };

  return (
    <div className="voile" onMouseDown={onFermer}>
      <div className="selecteur" onMouseDown={e => e.stopPropagation()} onKeyDown={clavier} role="dialog" aria-label="Choisir une affaire">
        <div className="sel-tete">
          <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un code ou un nom d'affaire…" />
          <span className="sel-nb">{nbCreneaux} créneau{nbCreneaux > 1 ? 'x' : ''}</span>
        </div>
        <div className="sel-liste">
          {sections.s.map(s => (
            <div key={s.titre}>
              <div className="sel-section">{s.titre}</div>
              {s.items.map(ligne)}
            </div>
          ))}
          {sections.clos.length > 0 && (
            <div>
              {!q && !voirClos
                ? <button className="sel-plus" onClick={() => setVoirClos(true)}>Afficher les affaires clôturées ({sections.clos.length})</button>
                : <><div className="sel-section">Affaires clôturées — saisie soumise à confirmation</div>{sections.clos.map(ligne)}</>}
            </div>
          )}
          {!aplat.length && <div className="sel-vide">Aucune affaire ne correspond.</div>}
        </div>
        <div className="sel-pied">
          <button className="btn btn-sec btn-sm" onClick={() => onChoisir(null)}>Vider {nbCreneaux > 1 ? 'les créneaux' : 'le créneau'}</button>
          <span className="aide">↑↓ pour naviguer · Entrée pour choisir · Échap pour fermer</span>
        </div>
      </div>
    </div>
  );
}

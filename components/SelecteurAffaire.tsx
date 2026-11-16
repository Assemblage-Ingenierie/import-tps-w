'use client';
// Sélecteur d'affaire (design « Mes affaires ») : onglets Mes affaires /
// Terminées / Toutes, lignes en deux niveaux (code + pôle, nom), jours saisis
// sur l'exercice et état en pastille. La recherche porte sur tous les onglets.
// Choisir une affaire terminée déclenche toujours la confirmation habituelle.
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
  modeAjout?: boolean;                 // « Mes affaires » : choisir une affaire à suivre
  jours?: Map<string, number>;         // mes jours saisis sur l'exercice, par affaire
  couleur?: (a: AffaireLite) => string; // couleurs du mois (mêmes que la saisie)
  contexte?: string;                   // « Lun. 2 nov. · matinée », « 4 créneaux »…
}

type Onglet = 'mes' | 'terminees' | 'toutes';

function normal(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
const nb = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

function classeEtat(a: AffaireLite): string {
  if (a.horsAffaire) return 'etat-clos';
  if (a.etat === 'Chantier') return 'etat-chantier';
  if (a.etat === 'AO') return 'etat-ao';
  if (['Etude', 'En Cours'].includes(a.etat)) return 'etat-actif';
  return a.clos ? 'etat-clos' : 'etat-actif';
}

export default function SelecteurAffaire({ affaires, mesIds, recentes, nbCreneaux, onChoisir, onFermer, modeAjout, jours, couleur, contexte }: Props) {
  const [q, setQ] = useState('');
  const [onglet, setOnglet] = useState<Onglet>(modeAjout ? 'toutes' : 'mes');
  const [actif, setActif] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const parCode = (a: AffaireLite, b: AffaireLite) => a.code.localeCompare(b.code, 'fr');
  const parJours = (a: AffaireLite, b: AffaireLite) => (jours?.get(b.id) || 0) - (jours?.get(a.id) || 0) || parCode(a, b);

  const listes = useMemo(() => {
    const mien = (a: AffaireLite) => mesIds.has(a.id) && !a.horsAffaire;
    const parId = new Map(affaires.map(a => [a.id, a]));
    return {
      recentes: recentes.map(id => parId.get(id)).filter((a): a is AffaireLite => !!a && !a.clos),
      mesEnCours: affaires.filter(a => mien(a) && !a.clos).sort(parJours),
      hors: affaires.filter(a => a.horsAffaire && !a.clos).sort(parCode),
      mesTerminees: affaires.filter(a => (modeAjout ? true : mien(a)) && a.clos && !a.horsAffaire).sort(parJours),
      toutes: affaires.filter(a => !a.clos && !a.horsAffaire).sort(parCode),
      autresTerminees: affaires.filter(a => a.clos && !a.horsAffaire && !mien(a)).sort(parCode),
    };
  }, [affaires, mesIds, recentes, modeAjout, jours]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sections affichées : celles de l'onglet, ou, en recherche, tous les onglets regroupés.
  const sections = useMemo(() => {
    const n = normal(q.trim());
    const vus = new Set<string>();
    const prendre = (l: AffaireLite[]) => l.filter(a => (!n || normal(`${a.code} ${a.nom}`).includes(n)) && !vus.has(a.id) && (vus.add(a.id), true));
    let s: { titre: string; items: AffaireLite[] }[];
    if (n) {
      s = [
        { titre: 'Mes affaires', items: prendre([...listes.recentes, ...listes.mesEnCours, ...listes.hors]) },
        { titre: 'Mes affaires terminées — confirmation demandée', items: prendre(listes.mesTerminees) },
        { titre: 'Autres affaires en cours', items: prendre(listes.toutes) },
        { titre: 'Autres affaires terminées — confirmation demandée', items: prendre(listes.autresTerminees) },
      ];
    } else if (onglet === 'mes') {
      s = [
        { titre: 'Récentes', items: prendre(listes.recentes) },
        { titre: 'Mes affaires en cours', items: prendre(listes.mesEnCours) },
        { titre: 'Hors affaire', items: prendre(listes.hors) },
      ];
    } else if (onglet === 'terminees') {
      s = [{ titre: 'Saisie soumise à confirmation', items: prendre(listes.mesTerminees) }];
    } else {
      s = [{ titre: 'Toutes les affaires en cours', items: prendre(listes.toutes) }];
    }
    return s.filter(x => x.items.length);
  }, [listes, onglet, q]);

  const aplat = sections.flatMap(x => x.items);
  useEffect(() => { setActif(0); }, [q, onglet]);

  const ordre: Onglet[] = modeAjout ? ['toutes', 'terminees'] : ['mes', 'terminees', 'toutes'];
  function clavier(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onFermer(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActif(i => Math.min(i + 1, aplat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (aplat[actif]) onChoisir(aplat[actif]); }
    else if (!q && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      const i = ordre.indexOf(onglet) + (e.key === 'ArrowRight' ? 1 : -1);
      setOnglet(ordre[(i + ordre.length) % ordre.length]);
    }
  }
  useEffect(() => {
    document.querySelector('.selecteur .sel-option.actif')?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  const compte: Record<Onglet, number> = {
    mes: listes.mesEnCours.length + listes.hors.length,
    terminees: listes.mesTerminees.length,
    toutes: listes.toutes.length,
  };
  const libelle: Record<Onglet, string> = { mes: 'Mes affaires', terminees: 'Terminées', toutes: 'Toutes' };

  const indexDe = new Map(aplat.map((a, n) => [a.id, n]));
  const ligne = (a: AffaireLite) => {
    const idx = indexDe.get(a.id) ?? -1;
    const j = jours?.get(a.id) || 0;
    return (
      <button key={a.id} className={`sel-option ${idx === actif ? 'actif' : ''} ${a.clos ? 'clos' : ''}`}
        onMouseEnter={() => setActif(idx)} onClick={() => onChoisir(a)}>
        <span className="sel-affaire">
          <span>
            <span className="pastille" style={{ background: a.clos ? '#9CA3AF' : (couleur ? couleur(a) : couleurAffaire(a)) }} />
            <span className="sel-code">{a.code}</span>
            {a.pole && <span className="ma-etiquette">{a.pole}</span>}
          </span>
          <span className="sel-nom">{a.nom}</span>
        </span>
        <span className="sel-droite">
          {j > 0 && <span className="sel-jours">{nb(j)} j</span>}
          <span className={`etat-pastille ${classeEtat(a)}`}>{a.horsAffaire ? 'Hors affaire' : (a.etat || '—')}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="voile" onMouseDown={onFermer}>
      <div className="selecteur" onMouseDown={e => e.stopPropagation()} onKeyDown={clavier} role="dialog" aria-label="Choisir une affaire">
        <div className="sel-tete2">
          <div className="sel-recherche">
            <span aria-hidden="true">⌕</span>
            <input ref={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un code ou un nom d'affaire…" />
          </div>
          <div className="sel-onglets" role="tablist">
            {ordre.map(o => (
              <button key={o} role="tab" aria-selected={!q && onglet === o} className={!q && onglet === o ? 'actif' : ''} onClick={() => { setQ(''); setOnglet(o); input.current?.focus(); }}>
                {libelle[o]} <span className="ma-compte">{compte[o]}</span>
              </button>
            ))}
            {!modeAjout && <span className="sel-contexte">{contexte || `${nbCreneaux} créneau${nbCreneaux > 1 ? 'x' : ''}`}</span>}
          </div>
        </div>
        <div className="sel-liste">
          {sections.map(s => (
            <div key={s.titre}>
              <div className="sel-section">{s.titre}</div>
              {s.items.map(ligne)}
            </div>
          ))}
          {!aplat.length && <div className="sel-vide">{q ? 'Aucune affaire ne correspond.' : onglet === 'terminees' ? 'Aucune affaire terminée.' : 'Aucune affaire.'}</div>}
        </div>
        <div className="sel-pied">
          {!modeAjout && <button className="btn btn-sec btn-sm" onClick={() => onChoisir(null)}>Vider {nbCreneaux > 1 ? 'les créneaux' : 'le créneau'}</button>}
          <span className="aide">↑↓ naviguer · ← → onglets · Entrée choisir · Échap fermer</span>
        </div>
      </div>
    </div>
  );
}

'use client';
// Récap façon « Spotify Wrapped » : une suite de cartes plein écran qui
// défilent seules (6 s), avec barres de progression. Clic à droite ou → :
// suivante ; à gauche ou ← : précédente ; Échap : fermer.
import { useCallback, useEffect, useState } from 'react';

export interface Carte {
  fond: string;            // couleur ou dégradé CSS
  sur?: string;            // petite ligne au-dessus
  grand: string;           // chiffre ou titre principal
  texte?: string;          // phrase sous le titre
  liste?: { libelle: string; valeur: string; part?: number }[];
}

const DUREE = 6000;

export default function Wrapped({ cartes, onFermer }: { cartes: Carte[]; onFermer: () => void }) {
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(false);
  const [debut, setDebut] = useState(() => Date.now());
  const [maintenant, setMaintenant] = useState(() => Date.now());

  const aller = useCallback((n: number) => {
    if (n >= cartes.length) { onFermer(); return; }
    setI(Math.max(0, n)); setDebut(Date.now()); setMaintenant(Date.now());
  }, [cartes.length, onFermer]);

  useEffect(() => {
    if (pause) return;
    const t = setInterval(() => {
      const m = Date.now();
      setMaintenant(m);
      if (m - debut >= DUREE) aller(i + 1);
    }, 50);
    return () => clearInterval(t);
  }, [i, debut, pause, aller]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); aller(i + 1); }
      else if (e.key === 'ArrowLeft') aller(i - 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [i, aller, onFermer]);

  const c = cartes[i];
  const avance = Math.min(1, (maintenant - debut) / DUREE);

  return (
    <div className="wr-voile" onClick={onFermer}>
      <div className="wr-carte" style={{ background: c.fond }} onClick={e => e.stopPropagation()}
        onMouseDown={() => setPause(true)} onMouseUp={() => { setPause(false); setDebut(Date.now() - avance * DUREE); }}>
        <div className="wr-progres">
          {cartes.map((_, n) => (
            <span key={n}><span style={{ width: `${n < i ? 100 : n === i ? avance * 100 : 0}%` }} /></span>
          ))}
        </div>
        <button className="wr-fermer" aria-label="Fermer" onClick={onFermer}>×</button>
        <div className="wr-contenu" key={i}>
          {c.sur && <div className="wr-sur">{c.sur}</div>}
          <div className="wr-grand">{c.grand}</div>
          {c.texte && <div className="wr-texte">{c.texte}</div>}
          {c.liste && (
            <ol className="wr-liste">
              {c.liste.map((l, n) => (
                <li key={n}>
                  <span className="wr-rang">{n + 1}</span>
                  <span className="wr-lib">{l.libelle}</span>
                  <span className="wr-val">{l.valeur}</span>
                  {l.part != null && <span className="wr-barre"><span style={{ width: `${Math.max(4, l.part * 100)}%` }} /></span>}
                </li>
              ))}
            </ol>
          )}
        </div>
        <button className="wr-zone gauche" aria-label="Carte précédente" onClick={() => aller(i - 1)} />
        <button className="wr-zone droite" aria-label="Carte suivante" onClick={() => aller(i + 1)} />
        <div className="wr-pied">Carnet · Assemblage ingénierie</div>
      </div>
    </div>
  );
}

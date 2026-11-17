'use client';
// Proposition d'installer Carnet sur l'écran d'accueil du téléphone.
//  · Android (Chrome, Edge…) : le navigateur fournit l'événement
//    « beforeinstallprompt » : bouton « Installer » qui ouvre sa fenêtre.
//  · iPhone / iPad (Safari) : Apple ne permet pas aux sites d'ouvrir cette
//    fenêtre ; on montre le geste à faire (Partager → « Sur l'écran d'accueil »).
// Jamais affichée si Carnet est déjà ouvert comme application installée.
// « Plus tard » la masque 14 jours (mémorisé dans ce navigateur).
import { useEffect, useState } from 'react';

const CLE = 'carnet_installation_masquee_jusqua';
const QUINZAINE = 14 * 24 * 3600 * 1000;

interface InvitationInstall extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

function dejaInstallee() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function estIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
function masquee() {
  try { return Number(localStorage.getItem(CLE) || 0) > Date.now(); } catch { return false; }
}

// Icône « Partager » de Safari (carré et flèche vers le haut).
const Partager = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Partager">
    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);
const Ajouter = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Ajouter">
    <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8" /><path d="M8 12h8" />
  </svg>
);

export default function ProposerInstallation() {
  const [mode, setMode] = useState<'ios' | 'android' | null>(null);
  const [invitation, setInvitation] = useState<InvitationInstall | null>(null);

  useEffect(() => {
    if (dejaInstallee() || masquee()) return;
    const telephone = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (estIos() && telephone) { const t = setTimeout(() => setMode('ios'), 1500); return () => clearTimeout(t); }
    const capter = (e: Event) => { e.preventDefault(); setInvitation(e as InvitationInstall); if (telephone) setMode('android'); };
    const installee = () => setMode(null);
    window.addEventListener('beforeinstallprompt', capter);
    window.addEventListener('appinstalled', installee);
    return () => { window.removeEventListener('beforeinstallprompt', capter); window.removeEventListener('appinstalled', installee); };
  }, []);

  if (!mode) return null;
  const plusTard = () => { try { localStorage.setItem(CLE, String(Date.now() + QUINZAINE)); } catch { /* stockage indisponible */ } setMode(null); };

  return (
    <div className="inst-voile" role="dialog" aria-modal="true" aria-label="Installer Carnet" onClick={plusTard}>
      <div className="inst-carte" onClick={e => e.stopPropagation()}>
        <div className="inst-tete">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/apple-icon" alt="" width={56} height={56} className="inst-icone" />
          <div>
            <strong>Installer Carnet</strong>
            <span>Ouvre Carnet d&apos;un geste depuis ton écran d&apos;accueil, en plein écran, comme une application.</span>
          </div>
        </div>
        {mode === 'ios' ? (
          <ol className="inst-etapes">
            <li><span className="inst-num">1</span>Touche <span className="inst-bouton"><Partager /></span> <b>Partager</b>, dans la barre de Safari (en bas, ou en haut sur iPad).</li>
            <li><span className="inst-num">2</span>Fais défiler et choisis <span className="inst-bouton"><Ajouter /></span> <b>Sur l&apos;écran d&apos;accueil</b>.</li>
            <li><span className="inst-num">3</span>Touche <b>Ajouter</b> en haut à droite.</li>
          </ol>
        ) : (
          <p className="inst-texte">Ton navigateur peut ajouter Carnet à l&apos;écran d&apos;accueil en un geste.</p>
        )}
        <div className="inst-actions">
          <button className="btn btn-sec" onClick={plusTard}>Plus tard</button>
          {mode === 'android' && invitation && (
            <button className="btn btn-pri" onClick={async () => { await invitation.prompt(); await invitation.userChoice.catch(() => null); setInvitation(null); setMode(null); }}>Installer</button>
          )}
          {mode === 'ios' && <button className="btn btn-pri" onClick={plusTard}>J&apos;ai compris</button>}
        </div>
        {mode === 'ios' && <div className="inst-fleche" aria-hidden="true" />}
      </div>
    </div>
  );
}

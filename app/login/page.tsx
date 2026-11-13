'use client';
// Connexion Google (Google Identity Services). Le jeton est vérifié côté
// serveur par /api/auth/callback ; le domaine @assemblage.net y est imposé.
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window { google?: any }
}

export default function Login() {
  const bouton = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState<{ t: string; d?: string; err: boolean } | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      const conf = await fetch('/api/me').then(r => r.json()).catch(() => ({}));
      if (annule) return;
      if (conf.connecte) { location.replace('/saisie'); return; }
      if (!conf.clientId) { setMsg({ t: 'Application non configurée', d: 'La variable GOOGLE_CLIENT_ID n\'est pas définie côté serveur.', err: true }); return; }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => {
        window.google.accounts.id.initialize({
          client_id: conf.clientId,
          hd: conf.domaine || undefined, // affichage seulement : revérifié côté serveur
          callback: async (rep: { credential: string }) => {
            setMsg({ t: 'Vérification…', err: false });
            try {
              const r = await fetch('/api/auth/callback', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: rep.credential }),
              });
              const d = await r.json().catch(() => ({}));
              if (r.ok) { location.replace('/saisie'); return; }
              setMsg({ t: d.erreur || 'Connexion refusée', d: d.detail, err: true });
            } catch (e) {
              setMsg({ t: 'Erreur réseau', d: String((e as Error).message), err: true });
            }
          },
        });
        if (bouton.current) {
          window.google.accounts.id.renderButton(bouton.current, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'fr', width: 280 });
        }
      };
      s.onerror = () => setMsg({ t: 'Impossible de charger Google Identity', d: 'Vérifiez votre connexion ou un éventuel bloqueur.', err: true });
      document.head.appendChild(s);
    })();
    return () => { annule = true; };
  }, []);

  return (
    <div className="login">
      <div className="login-box">
        <div className="marque"><img src="/logo-assemblage-noir.png" alt="Assemblage ingénierie" width={34} height={49} /></div>
        <h1>Carnet</h1>
        <p className="sous">Assemblage ingénierie<br />Connexion avec votre compte Google @assemblage.net</p>
        <div ref={bouton} className="gbtn" />
        {msg && <div className={`msg ${msg.err ? 'err' : 'info'}`}><strong>{msg.t}</strong>{msg.d && <><br />{msg.d}</>}</div>}
      </div>
    </div>
  );
}

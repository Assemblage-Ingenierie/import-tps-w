'use client';
// Menu latéral (gauche) : sections dépliées, page courante surlignée,
// utilisateur, bascule User / Admin et déconnexion en pied.
// Téléphone : barre fine en haut, le menu s'ouvre par-dessus la page.
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

// Icônes au trait (24×24), dessinées en SVG pour ne dépendre d'aucune bibliothèque.
const ICONES = {
  liste: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  calendrier: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  dossier: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  archive: 'M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4',
  valider: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  graphique: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  reglages: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  import: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  sortie: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};
type NomIcone = keyof typeof ICONES;
interface Item { href: string; label: string; icone: NomIcone; brut?: boolean }
interface Section { titre: string; items: Item[] }

function Icone({ nom }: { nom: NomIcone }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONES[nom]} />
    </svg>
  );
}

export default function Entete({ nom, email, admin, peutBasculer }: { nom: string; email: string; admin: boolean; peutBasculer: boolean; test?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [bascule, setBascule] = useState(false);
  const chemin = usePathname();
  const params = useSearchParams();

  useEffect(() => { setOuvert(false); }, [chemin, params]);

  // Bascule de vue (Admin) : le serveur pose le cookie, puis la page est
  // rechargée pour que menus, droits et données suivent la nouvelle vue.
  async function changerVue(vue: 'user' | 'admin') {
    if (bascule || (vue === 'admin') === admin) return;
    setBascule(true);
    const r = await fetch('/api/auth/vue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vue }) });
    if (!r.ok) { setBascule(false); return; }
    const ici = location.pathname + location.search;
    location.assign(vue === 'user' && ici.startsWith('/admin') ? '/saisie' : ici);
  }

  const sections: Section[] = [
    // Liste / Calendrier et En cours / Terminées sont des onglets dans chaque page.
    { titre: '', items: [
      { href: '/affaires', label: 'Mes affaires', icone: 'dossier' },
      { href: '/saisie', label: 'Mon temps de travail', icone: 'calendrier' },
    ] },
  ];
  if (admin) sections.push({ titre: 'Administration', items: [
    { href: '/admin/validation', label: 'Validation mensuelle', icone: 'valider' },
    { href: '/admin/balances', label: 'Balances', icone: 'graphique' },
    { href: '/admin/parametres', label: 'Paramètres', icone: 'reglages' },
    { href: '/admin/import', label: 'Import Payfit et bilan', icone: 'import', brut: true },
  ] });

  // Page courante : même chemin, et même « vue » quand le lien en précise une.
  const actif = (href: string) => {
    const [p, q] = href.split('?');
    if (chemin !== p) return p === '/admin/validation' && chemin.startsWith('/admin/collaborateur');
    if (!q) return true;
    const [cle, val] = q.split('=');
    const courant = params.get(cle) || (p === '/saisie' ? 'liste' : p === '/affaires' ? 'en-cours' : '');
    return courant === val;
  };

  const initiales = (nom || email).split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <div className="barre-mobile">
        <button className="burger" aria-label="Ouvrir le menu" aria-expanded={ouvert} onClick={() => setOuvert(o => !o)}>☰</button>
        <Link href="/saisie" className="logo"><img src="/logo-assemblage-noir.png" alt="Assemblage ingénierie" width={20} height={29} /></Link>
        <span className="titre">Carnet</span>
      </div>
      {ouvert && <div className="lat-voile" onClick={() => setOuvert(false)} />}

      <aside className={`lateral ${ouvert ? 'ouvert' : ''}`} aria-label="Navigation">
        <div className="lat-tete">
          <Link href="/saisie" className="logo"><img src="/logo-assemblage-noir.png" alt="Assemblage ingénierie" width={20} height={29} /></Link>
          <div className="titre">Carnet<small>Assemblage ingénierie</small></div>
        </div>

        <nav className="lat-nav">
          {sections.map(s => (
            <div className="lat-section" key={s.titre}>
              {s.titre && <div className="lat-titre">{s.titre}</div>}
              {s.items.map(i => {
                const estActif = actif(i.href);
                const contenu = <><Icone nom={i.icone} /><span>{i.label}</span></>;
                return i.brut
                  ? <a key={i.href} href={i.href} className="lat-lien">{contenu}</a>
                  : <Link key={i.href} href={i.href} className={`lat-lien ${estActif ? 'actif' : ''}`} aria-current={estActif ? 'page' : undefined}>{contenu}</Link>;
              })}
            </div>
          ))}
        </nav>

        <div className="lat-pied">
          <div className="lat-user" title={email}>
            <span className="avatar">{initiales}</span>
            <span className="lat-nom">{nom}<small>{email}</small></span>
          </div>
          {peutBasculer && (
            <span className="bascule" role="group" aria-label="Vue" title="Basculer entre l'interface salarié et l'interface administrateur">
              <button className={!admin ? 'on' : ''} aria-pressed={!admin} disabled={bascule} onClick={() => changerVue('user')}>User</button>
              <button className={admin ? 'on' : ''} aria-pressed={admin} disabled={bascule} onClick={() => changerVue('admin')}>Admin</button>
            </span>
          )}
          <a href="/api/auth/logout" className="lat-lien lat-sortie"><Icone nom="sortie" /><span>Déconnexion</span></a>
        </div>
      </aside>
    </>
  );
}

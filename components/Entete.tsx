'use client';
// En-tête avec menus déroulants (bureau : barre ; mobile : menu ☰).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Item { href: string; label: string; brut?: boolean }
interface Menu { label: string; items: Item[] }

export default function Entete({ nom, email, admin, peutBasculer, test }: { nom: string; email: string; admin: boolean; peutBasculer: boolean; test: boolean }) {
  const [bascule, setBascule] = useState(false);
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
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const chemin = usePathname();

  useEffect(() => { setOuvert(null); setMobile(false); }, [chemin]);
  useEffect(() => {
    const f = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(null); };
    document.addEventListener('click', f);
    return () => document.removeEventListener('click', f);
  }, []);

  const menus: Menu[] = [
    { label: 'Mes affaires', items: [
      { href: '/affaires?vue=en-cours', label: 'Mes affaires en cours' },
      { href: '/affaires?vue=terminees', label: 'Mes affaires terminées' },
    ] },
    { label: 'Mon suivi de temps de travail', items: [
      { href: '/saisie?vue=liste', label: 'Saisie — vue liste' },
      { href: '/saisie?vue=calendrier', label: 'Saisie — vue calendrier' },
    ] },
  ];
  if (admin) menus.push({ label: 'Administration', items: [
    { href: '/admin/validation', label: 'Validation mensuelle' },
    { href: '/admin/balances', label: 'Balances' },
    { href: '/admin/parametres', label: 'Paramètres' },
    { href: '/admin/import', label: 'Import Payfit, contrôles et bilan (outil historique)', brut: true },
  ] });

  return (
    <header className="entete" ref={ref}>
      <Link href="/saisie" className="logo"><span>.A</span></Link>
      <div className="titre">Suivi des temps<small>Assemblage ingénierie</small></div>
      {test && <span className="badge-env" title="Les saisies sont écrites dans la table Temps W TEST">TEST</span>}
      <button className="burger" aria-label="Menu" onClick={e => { e.stopPropagation(); setMobile(m => !m); }}>☰</button>
      <nav className={`menus ${mobile ? 'ouvert' : ''}`}>
        {menus.map(m => (
          <div key={m.label} className={`menu ${ouvert === m.label ? 'ouvert' : ''}`}>
            <button onClick={e => { e.stopPropagation(); setOuvert(o => (o === m.label ? null : m.label)); }} aria-expanded={ouvert === m.label}>
              {m.label} <span className="chevron">▾</span>
            </button>
            <div className="deroulant">
              {m.items.map(i => i.brut
                ? <a key={i.href} href={i.href}>{i.label}</a>
                : <Link key={i.href} href={i.href}>{i.label}</Link>)}
            </div>
          </div>
        ))}
        <div className="session">
          <span title={email}>{nom}</span>
          {peutBasculer && (
            <span className="bascule" role="group" aria-label="Vue" title="Basculer entre l'interface salarié et l'interface administrateur">
              <button className={!admin ? 'on' : ''} aria-pressed={!admin} disabled={bascule} onClick={() => changerVue('user')}>User</button>
              <button className={admin ? 'on' : ''} aria-pressed={admin} disabled={bascule} onClick={() => changerVue('admin')}>Admin</button>
            </span>
          )}
          <a href="/api/auth/logout" className="deconnexion">Déconnexion</a>
        </div>
      </nav>
    </header>
  );
}

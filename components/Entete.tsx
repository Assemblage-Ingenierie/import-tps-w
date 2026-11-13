'use client';
// En-tête avec menus déroulants (bureau : barre ; mobile : menu ☰).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Item { href: string; label: string; brut?: boolean }
interface Menu { label: string; items: Item[] }

export default function Entete({ nom, email, admin, test }: { nom: string; email: string; admin: boolean; test: boolean }) {
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
          <span title={email}>{nom}{admin && <em className="role">Admin</em>}</span>
          <a href="/api/auth/logout" className="deconnexion">Déconnexion</a>
        </div>
      </nav>
    </header>
  );
}

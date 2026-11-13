import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { utilisateurCourant } from '@/lib/auth';
import { envCourant } from '@/lib/config';
import Entete from '@/components/Entete';
import Inspecteur from '@/components/Inspecteur';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await utilisateurCourant();
  if (!u) redirect('/login');
  return (
    <div className="app">
      <Suspense fallback={<aside className="lateral" />}>
        <Entete nom={u.nom || u.email} email={u.email} admin={u.role === 'admin'} peutBasculer={u.estAdmin} test={envCourant() === 'test'} />
      </Suspense>
      <div className="app-contenu">
        <main className="page">{children}</main>
      </div>
      {u.estAdmin && <Inspecteur />}
    </div>
  );
}

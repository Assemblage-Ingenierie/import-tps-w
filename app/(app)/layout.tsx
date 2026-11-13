import { redirect } from 'next/navigation';
import { utilisateurCourant } from '@/lib/auth';
import { envCourant } from '@/lib/config';
import Entete from '@/components/Entete';
import Inspecteur from '@/components/Inspecteur';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await utilisateurCourant();
  if (!u) redirect('/login');
  return (
    <>
      <Entete nom={u.nom || u.email} email={u.email} admin={u.role === 'admin'} test={envCourant() === 'test'} />
      <main className="page">{children}</main>
      {u.role === 'admin' && <Inspecteur />}
    </>
  );
}

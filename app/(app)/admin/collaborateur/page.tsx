// Vue Admin du mois d'un collaborateur : même écran que le User, en mode
// relecture / correction / validation.
import { Suspense } from 'react';
import Link from 'next/link';
import Saisie from '@/components/Saisie';

export default async function PageCollaborateur({ searchParams }: { searchParams: Promise<{ prenom?: string; ym?: string }> }) {
  const { prenom, ym } = await searchParams;
  if (!prenom) return <p>Collaborateur non précisé.</p>;
  return (
    <>
      <p className="retour"><Link href={`/admin/validation${ym ? `?ym=${ym}` : ''}`}>← Validation mensuelle</Link></p>
      <Suspense fallback={<div className="chargement">Chargement…</div>}><Saisie prenom={prenom} /></Suspense>
    </>
  );
}

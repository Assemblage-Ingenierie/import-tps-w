import { Suspense } from 'react';
import Saisie from '@/components/Saisie';

export default function PageSaisie() {
  return <Suspense fallback={<div className="chargement">Chargement…</div>}><Saisie /></Suspense>;
}

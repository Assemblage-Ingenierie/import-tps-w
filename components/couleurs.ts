import type { AffaireLite } from '@/lib/types';

// Couleur stable par affaire, dérivée du code. Hors affaire : gris.
export function couleurAffaire(a: Pick<AffaireLite, 'code' | 'horsAffaire'> | null | undefined): string {
  if (!a) return '#DFE4E8';
  if (a.horsAffaire) return '#9aa3ab';
  let h = 0;
  for (const c of a.code) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360}, 62%, 46%)`;
}

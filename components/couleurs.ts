import type { AffaireLite } from '@/lib/types';

// Couleur stable par affaire, dérivée du code. Hors affaire : gris.
export function couleurAffaire(a: Pick<AffaireLite, 'code' | 'horsAffaire'> | null | undefined): string {
  if (!a) return '#DFE4E8';
  if (a.horsAffaire) return '#9aa3ab';
  let h = 0;
  for (const c of a.code) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360}, 62%, 46%)`;
}

// Palette qualitative (texte blanc lisible, pas de rouge réservé aux erreurs).
const PALETTE = ['#4F46E5', '#0D9488', '#D97706', '#DB2777', '#0284C7', '#65A30D', '#7C3AED', '#EA580C', '#0891B2', '#059669'];

// Couleurs propres à un mois : les affaires les plus présentes reçoivent les
// premières teintes de la palette, sans doublon (au-delà de 10, on revient au
// hachage du code). Les codes hors affaire restent gris.
export function couleursDuMois(joursParAffaire: Map<string, number>, affaires: Map<string, Pick<AffaireLite, 'code' | 'horsAffaire'>>): Map<string, string> {
  const ordre = [...joursParAffaire].filter(([id]) => !affaires.get(id)?.horsAffaire).sort((a, b) => b[1] - a[1]);
  const m = new Map<string, string>();
  ordre.forEach(([id], i) => m.set(id, PALETTE[i] ?? couleurAffaire(affaires.get(id))));
  return m;
}

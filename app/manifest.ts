// Manifeste : « Ajouter à l'écran d'accueil » sur Android et iPhone ouvre
// Carnet en plein écran, comme une application.
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Carnet — Assemblage ingénierie',
    short_name: 'Carnet',
    description: 'Saisie des temps de travail',
    start_url: '/saisie',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    lang: 'fr',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}

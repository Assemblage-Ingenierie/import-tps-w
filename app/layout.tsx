import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Carnet — Assemblage ingénierie',
  robots: { index: false, follow: false },
  applicationName: "Carnet",
  // Ajout à l'écran d'accueil (iPhone) : plein écran, barre d'état claire.
  appleWebApp: { capable: true, title: "Carnet", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};
// Téléphone : zoom bloqué (pincement et double-tap), comme une application.
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false,
  viewportFit: 'cover', themeColor: '#FFFFFF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}

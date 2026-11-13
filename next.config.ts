import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // L'ancien outil Admin (import Payfit, contrôles, bilan) est une page statique
  // conservée telle quelle dans public/legacy. On l'expose sous une URL propre.
  async rewrites() {
    return [{ source: '/admin/import', destination: '/legacy/import.html' }];
  },
};

export default nextConfig;

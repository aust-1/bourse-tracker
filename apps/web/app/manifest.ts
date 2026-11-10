import type { MetadataRoute } from 'next';

/** Manifeste : l'application s'installe sur l'écran d'accueil (Android, iOS, ordinateur). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bourse Tracker',
    short_name: 'Bourse',
    description: 'Suivi de PEA : portefeuille en direct, alertes, historique.',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0f0a',
    theme_color: '#0a0f0a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

import type { Metadata, Viewport } from 'next';
import { Fira_Code, VT323 } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const fira = Fira_Code({ subsets: ['latin'], variable: '--font-fira', display: 'swap' });
const vt323 = VT323({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-vt323',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bourse Tracker',
  applicationName: 'Bourse Tracker',
  icons: {
    // favicon : .ico (16, 32, 48 px) pour les navigateurs qui le demandent d'office, SVG net à toute taille
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  // plein écran une fois ajoutée à l'écran d'accueil d'un iPhone
  appleWebApp: { capable: true, title: 'Bourse', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0a0f0a',
  width: 'device-width',
  initialScale: 1,
  // le site reste zoomable (accessibilité)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fira.variable} ${vt323.variable}`}>
      <body>
        {children}
        {/* Statistiques de visite (Rybbit auto-hébergé, sans cookie) ; l'ID vient du tableau de bord */}
        {process.env.NODE_ENV === 'production' && (
          <Script
            src="https://analytics.eliott-roussille.fr/api/script.js?siteId=2a423da9594b"
            data-site-id="3"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}

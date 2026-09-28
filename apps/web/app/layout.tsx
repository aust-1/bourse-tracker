import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = { title: 'Bourse Tracker' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        {/* Statistiques de visite (Rybbit auto-hébergé, sans cookie) ; l'ID vient du tableau de bord */}
        {process.env.NODE_ENV === 'production' && (
          <Script
            src="https://analytics.eliott-roussille.fr/api/script.js"
            data-site-id="3"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}

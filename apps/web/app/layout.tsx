import type { Metadata } from 'next';
import { Fira_Code, VT323 } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const fira = Fira_Code({ subsets: ['latin'], variable: '--font-fira', display: 'swap' });
const vt323 = VT323({ subsets: ['latin'], weight: '400', variable: '--font-vt323', display: 'swap' });

export const metadata: Metadata = { title: 'Bourse Tracker' };

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

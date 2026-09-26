import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const standalone = Boolean(process.env.NEXT_STANDALONE);

const nextConfig: NextConfig = {
  // sortie autonome pour l'image Docker uniquement (NEXT_STANDALONE=1) ; `next start` sinon
  output: standalone ? 'standalone' : undefined,
  // monorepo : la trace des fichiers doit partir de la racine pour inclure les packages partagés
  outputFileTracingRoot: standalone
    ? path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
    : undefined,
  transpilePackages: ['@bourse/core', '@bourse/providers', '@bourse/db'],
};

export default nextConfig;

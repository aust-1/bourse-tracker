import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // sortie autonome pour l'image Docker uniquement (NEXT_STANDALONE=1) ; `next start` sinon
  output: process.env.NEXT_STANDALONE ? 'standalone' : undefined,
  transpilePackages: ['@bourse/core'],
};

export default nextConfig;

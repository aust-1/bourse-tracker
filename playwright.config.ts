import { defineConfig } from '@playwright/test';
import { ANON_KEY, SUPABASE_URL } from './e2e/env';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  webServer: {
    // build de production : plus proche de la prod, et évite les verrous de fichiers de `next dev` sous Windows
    command: `pnpm --filter @bourse/web build && pnpm --filter @bourse/web exec next start --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['test/**/*.live.ts'], testTimeout: 30000 } });

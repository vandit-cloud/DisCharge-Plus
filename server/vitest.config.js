import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: { NODE_ENV: 'test', ENABLE_DEMO_TOOLS: 'true', DOSE_GRACE_MINUTES: '120', JWT_EXPIRES_IN: '30d' },
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});

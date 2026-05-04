import path from 'node:path';
import { defineConfig } from '@playwright/test';

const e2eDataDir = path.resolve(process.cwd(), 'server', '.e2e-data');

export default defineConfig({
  testDir: './client/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server/dist/index.js',
    env: {
      NODE_ENV: 'test',
      PORT: '4173',
      DATA_DIR: e2eDataDir,
      ADMIN_CODE: 'admin-dev-code',
      COOKIE_SECRET: 'playwright-cookie-secret',
    },
    url: 'http://127.0.0.1:4173/api/health',
    timeout: 180_000,
    reuseExistingServer: process.env.PW_REUSE_SERVER === 'true',
  },
});

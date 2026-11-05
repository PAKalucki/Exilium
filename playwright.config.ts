import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      APP_ORIGIN: 'http://127.0.0.1:5174',
      APP_ADDITIONAL_ORIGINS: '',
      DATABASE_PATH: `/tmp/exilium-e2e-${randomUUID()}.sqlite`,
      DEV_LOGIN_ENABLED: 'true',
      DISCORD_CLIENT_ID: '',
      DISCORD_CLIENT_SECRET: '',
      DISCORD_GUILD_ID: '',
    },
  },
});

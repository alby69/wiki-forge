import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const mockOpencode = path.resolve(process.cwd(), 'tests/e2e/fixtures/mock-opencode.mjs');
const userStore = path.join(os.tmpdir(), 'wiki-forge-e2e-users.json');
const stateDir = path.join(os.tmpdir(), 'wiki-forge-e2e-state');
fs.rmSync(userStore, { force: true });
fs.rmSync(stateDir, { recursive: true, force: true });

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3101',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && node --import tsx src/backend/server/httpServer.ts',
    url: 'http://127.0.0.1:3101',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: '3101',
      WIKIFORGE_EMBED_SCHEDULER: 'false',
      OPENCODE_BIN: mockOpencode,
      WIKIFORGE_LLM_PROVIDER: 'opencode',
      WIKIFORGE_LOCAL_ACTOR: 'e2e',
      WIKIFORGE_USER_STORE_FILE: userStore,
      WIKIFORGE_STATE_DIR: stateDir,
      WIKIFORGE_ADMIN_USERNAME: 'e2e-admin',
      WIKIFORGE_ADMIN_PASSWORD: 'E2EPassword!2026',
    },
  },
});

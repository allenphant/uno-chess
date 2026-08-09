import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: [
    {
      command: 'npm run dev --workspace @uno-chess/server',
      url: 'http://127.0.0.1:3010/health',
      reuseExistingServer: true,
      env: { PORT: '3010', WEB_ORIGIN: 'http://127.0.0.1:4173' },
    },
    {
      command: 'npm run dev --workspace @uno-chess/web -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      env: { VITE_GAME_SERVER_URL: 'http://127.0.0.1:3010' },
    },
  ],
})

import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const systemBrowser = process.env.RENDERKIT_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
export default defineConfig({
  testDir: './tests', testMatch: '**/*.browser.ts', fullyParallel: false, workers: 1,
  retries: 0, timeout: 30000,
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5178 --strictPort',
    url: 'http://127.0.0.1:5178', reuseExistingServer: !process.env.CI,
  },
  use: {
    viewport: { width: 1440, height: 1000 }, headless: true,
    launchOptions: { executablePath: systemBrowser, args: ['--no-sandbox'] },
    screenshot: 'only-on-failure',
  },
});

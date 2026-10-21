/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		// Service workers would hide requests from page.route(); the PWA test re-enables them.
		serviceWorkers: 'block',
		locale: 'en-US',
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	// Tests run against the production build (static files + service worker).
	webServer: {
		command: 'npm run build && node scripts/serve-build.mjs',
		url: `http://localhost:${PORT}`,
		env: { PORT: String(PORT) },
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});

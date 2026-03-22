import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? 'github' : 'html',
	timeout: 30_000,

	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'mobile',
			use: { ...devices['iPhone 13'] }
		}
	],

	webServer: process.env.PLAYWRIGHT_BASE_URL
		? undefined
		: {
				command: 'npm run preview',
				port: 4173,
				reuseExistingServer: !process.env.CI,
				env: {
					PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
					PUBLIC_SUPABASE_ANON_KEY: process.env.PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
					PUBLIC_SENTRY_DSN: '',
					PUBLIC_SENTRY_ENVIRONMENT: 'test',
					PUBLIC_APP_URL: 'http://localhost:4173',
					OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-placeholder'
				}
			}
});

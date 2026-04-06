import { test, expect } from '@playwright/test';

test.describe('Auth Redirects', () => {
	test('unauthenticated user on root redirects to login', async ({ page }) => {
		await page.goto('/');
		await page.waitForURL('**/auth/login');
		await expect(page.locator('h1')).toContainText('IB Portal');
	});

	test('unauthenticated user on /portfolio redirects to login', async ({ page }) => {
		await page.goto('/portfolio');
		await page.waitForURL('**/auth/login');
	});

	test('unauthenticated user on /portfolio/trades redirects to login', async ({ page }) => {
		await page.goto('/portfolio/trades');
		await page.waitForURL('**/auth/login');
	});

	test('unauthenticated user on /portfolio/journal redirects to login', async ({ page }) => {
		await page.goto('/portfolio/journal');
		await page.waitForURL('**/auth/login');
	});

	test('unauthenticated user on /portfolio/analytics redirects to login', async ({ page }) => {
		await page.goto('/portfolio/analytics');
		await page.waitForURL('**/auth/login');
	});

	test('unauthenticated user on /admin redirects to login', async ({ page }) => {
		await page.goto('/admin');
		await page.waitForURL('**/auth/login');
	});

	test('unauthenticated user on /ib redirects to login', async ({ page }) => {
		await page.goto('/ib');
		await page.waitForURL('**/auth/login');
	});

	test('login page is accessible without auth', async ({ page }) => {
		const response = await page.goto('/auth/login');
		expect(response?.status()).toBe(200);
	});

	// ─── Additional protected routes ────────────────────────────────────────

	test('unauthenticated user on /settings redirects to login', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForURL('**/auth/login');
	});

	test('unauthenticated user on /settings/security redirects to login', async ({ page }) => {
		await page.goto('/settings/security');
		await page.waitForURL('**/auth/login');
	});

	test('unauthenticated user on /admin/approvals redirects to login', async ({ page }) => {
		await page.goto('/admin/approvals');
		await page.waitForURL('**/auth/login');
	});

	test('unauthenticated user on /admin/ibs redirects to login', async ({ page }) => {
		await page.goto('/admin/ibs');
		await page.waitForURL('**/auth/login');
	});

	test('unauthenticated user on /ib/clients redirects to login', async ({ page }) => {
		await page.goto('/ib/clients');
		await page.waitForURL('**/auth/login');
	});

	test('unauthenticated user on /portfolio/playbook redirects to login', async ({ page }) => {
		await page.goto('/portfolio/playbook');
		await page.waitForURL('**/auth/login');
	});


	// ─── Public routes remain accessible ────────────────────────────────────

	test('/offline page is accessible without auth', async ({ page }) => {
		const response = await page.goto('/offline');
		expect(response?.status()).toBe(200);
	});

	// ─── API endpoints redirect unauthenticated requests to login ──────────
	// SvelteKit hooks intercept ALL routes including /api/* and redirect to
	// /auth/login (303) when no session. Playwright follows the redirect,
	// so we verify the final URL landed on the login page.

	test('POST /api/portfolio/journal without auth redirects to login', async ({ request }) => {
		const response = await request.post('/api/portfolio/journal', {
			data: { date: '2024-01-15', mood: 3 }
		});
		expect(response.url()).toContain('/auth/login');
	});


	test('POST /api/admin/approve without auth redirects to login', async ({ request }) => {
		const response = await request.post('/api/admin/approve', {
			data: { account_id: 'test', action: 'approved' }
		});
		expect(response.url()).toContain('/auth/login');
	});

	test('POST /api/ib/clients without auth redirects to login', async ({ request }) => {
		const response = await request.post('/api/ib/clients', {
			data: { client_name: 'Test', email: 'test@test.com' }
		});
		expect(response.url()).toContain('/auth/login');
	});
});

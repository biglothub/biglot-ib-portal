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
});

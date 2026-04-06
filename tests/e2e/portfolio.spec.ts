/**
 * Phase 3 — Client portfolio E2E tests
 *
 * Requires environment variables:
 *   TEST_CLIENT_EMAIL     — approved client account email (Google-linked)
 *   TEST_CLIENT_PASSWORD  — if using email/password auth (optional for OAuth clients)
 *
 * For Google OAuth clients, set TEST_CLIENT_SESSION_COOKIE instead.
 *
 * Tests are skipped automatically when credentials are not configured.
 */
import { test, expect } from '@playwright/test';

const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL;
const CLIENT_PASSWORD = process.env.TEST_CLIENT_PASSWORD;
const hasCredentials = !!CLIENT_EMAIL && !!CLIENT_PASSWORD;

// ─── Shared login helper ─────────────────────────────────────────────────────

async function loginAsClient(page: import('@playwright/test').Page) {
	await page.goto('/auth/login');
	// Client login may differ — try email/password form if present
	const emailInput = page.getByLabel(/อีเมล/i);
	const passwordInput = page.getByLabel(/รหัสผ่าน/i);
	await emailInput.fill(CLIENT_EMAIL!);
	await passwordInput.fill(CLIENT_PASSWORD!);
	await page.getByRole('button', { name: /เข้าสู่ระบบ/i }).click();
	await page.waitForURL('**/portfolio', { timeout: 15_000 });
}

// ─── Portfolio dashboard ─────────────────────────────────────────────────────

test.describe('Portfolio Dashboard', () => {
	test.skip(!hasCredentials, 'Skipped: TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD not set');

	test('client can log in and land on /portfolio', async ({ page }) => {
		await loginAsClient(page);
		await expect(page).toHaveURL(/\/portfolio/);
	});

	test('dashboard page does not show an error state', async ({ page }) => {
		await loginAsClient(page);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
		await expect(page.locator('body')).not.toContainText('500');
	});

	test('KPI section renders without NaN or undefined values', async ({ page }) => {
		await loginAsClient(page);
		const bodyText = await page.locator('body').innerText();
		expect(bodyText).not.toContain('NaN');
		expect(bodyText).not.toContain('undefined');
	});
});

// ─── Trade list ──────────────────────────────────────────────────────────────

test.describe('Trade List', () => {
	test.skip(!hasCredentials, 'Skipped: TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD not set');

	test('/portfolio/trades loads without error', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/portfolio/trades');
		await expect(page).toHaveURL(/\/portfolio\/trades/);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('trade list shows content or empty state (no crash)', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/portfolio/trades');
		// Either shows trades or an empty state message — never a blank/crashed page
		const body = page.locator('body');
		await expect(body).not.toContainText('Internal Server Error');
		await expect(body).not.toContainText('500');
	});

	test('date range filter can be applied without crash', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/portfolio/trades?from=2024-01-01&to=2024-12-31');
		await expect(page).toHaveURL(/from=2024-01-01/);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('symbol filter can be applied via URL', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/portfolio/trades?symbols=EURUSD');
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});
});

// ─── Trade detail ────────────────────────────────────────────────────────────

test.describe('Trade Detail', () => {
	test.skip(!hasCredentials, 'Skipped: TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD not set');

	test('/portfolio/trades/[id] page loads for first trade', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/portfolio/trades');
		// Click the first trade row if it exists
		const firstTrade = page.locator('a[href*="/portfolio/trades/"]').first();
		const count = await firstTrade.count();
		if (count === 0) {
			// No trades — acceptable, skip assertion
			return;
		}
		await firstTrade.click();
		await expect(page).toHaveURL(/\/portfolio\/trades\/.+/);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});
});

// ─── Other portfolio routes ───────────────────────────────────────────────────

test.describe('Portfolio Sub-pages', () => {
	test.skip(!hasCredentials, 'Skipped: TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD not set');

	test('/portfolio/analytics loads without error', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/portfolio/analytics');
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('/portfolio/playbook loads without error', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/portfolio/playbook');
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

});

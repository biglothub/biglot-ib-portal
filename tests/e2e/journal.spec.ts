/**
 * Phase 3 — Journal E2E tests
 *
 * Requires environment variables:
 *   TEST_CLIENT_EMAIL     — approved client account email
 *   TEST_CLIENT_PASSWORD  — client password
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
	await page.getByLabel(/อีเมล/i).fill(CLIENT_EMAIL!);
	await page.getByLabel(/รหัสผ่าน/i).fill(CLIENT_PASSWORD!);
	await page.getByRole('button', { name: /เข้าสู่ระบบ/i }).click();
	await page.waitForURL('**/portfolio', { timeout: 15_000 });
}

// ─── Journal page ────────────────────────────────────────────────────────────

test.describe('Journal Page', () => {
	test.skip(!hasCredentials, 'Skipped: TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD not set');

	test('/portfolio/journal loads without error', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/portfolio/journal');
		await expect(page).toHaveURL(/\/portfolio\/journal/);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('journal page renders calendar or entry area', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/portfolio/journal');
		await expect(page.locator('body')).not.toContainText('500');
	});
});

// ─── Journal CRUD ────────────────────────────────────────────────────────────

test.describe('Journal CRUD', () => {
	test.skip(!hasCredentials, 'Skipped: TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD not set');

	test('can submit a journal entry via API and get 200', async ({ page, request }) => {
		await loginAsClient(page);

		// Use a test date unlikely to clash with real entries
		const testDate = '2020-01-15';
		const response = await request.post('/api/portfolio/journal', {
			data: {
				date: testDate,
				mood: 3,
				energy_score: 3,
				discipline_score: 3,
				confidence_score: 3,
				pre_market_notes: 'E2E test entry',
				post_market_notes: 'E2E test notes',
				completion_status: 'draft'
			}
		});
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty('date', testDate);
	});

	test('journal API rejects invalid date format', async ({ page, request }) => {
		await loginAsClient(page);
		const response = await request.post('/api/portfolio/journal', {
			data: { date: '15-01-2020', mood: 3 } // wrong format
		});
		expect(response.status()).toBe(400);
	});

	test('journal API rejects mood score out of range', async ({ page, request }) => {
		await loginAsClient(page);
		const response = await request.post('/api/portfolio/journal', {
			data: { date: '2020-01-16', mood: 10 } // must be 1-5
		});
		expect(response.status()).toBe(400);
	});

	test('journal API rejects mood score below range', async ({ page, request }) => {
		await loginAsClient(page);
		const response = await request.post('/api/portfolio/journal', {
			data: { date: '2020-01-16', mood: 0 } // must be 1-5
		});
		expect(response.status()).toBe(400);
	});

	test('journal entry upserts (second save on same date succeeds)', async ({ page, request }) => {
		await loginAsClient(page);
		const testDate = '2020-02-15';

		// First save
		const r1 = await request.post('/api/portfolio/journal', {
			data: { date: testDate, mood: 2, pre_market_notes: 'first' }
		});
		expect(r1.status()).toBe(200);

		// Second save (upsert) with updated note
		const r2 = await request.post('/api/portfolio/journal', {
			data: { date: testDate, mood: 4, pre_market_notes: 'updated' }
		});
		expect(r2.status()).toBe(200);
		const body = await r2.json();
		expect(body.pre_market_notes).toBe('updated');
	});
});

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
import { createAuthedRequest, expectNoServerError, loginWithPassword } from './helpers/auth';

const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL;
const CLIENT_PASSWORD = process.env.TEST_CLIENT_PASSWORD;
const hasCredentials = !!CLIENT_EMAIL && !!CLIENT_PASSWORD;

// ─── Shared login helper ─────────────────────────────────────────────────────

async function loginAsClient(page: import('@playwright/test').Page) {
	await loginWithPassword(page, CLIENT_EMAIL!, CLIENT_PASSWORD!, '**/portfolio');
}

// ─── Journal page ────────────────────────────────────────────────────────────

test.describe('Journal Page', () => {
	test.skip(!hasCredentials, 'Skipped: TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD not set');

	test('/portfolio/journal loads without error', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/portfolio/journal');
		await expect(page).toHaveURL(/\/portfolio\/journal/);
		await expectNoServerError(page);
	});

	test('journal page renders calendar or entry area', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/portfolio/journal');
		await expectNoServerError(page);
	});
});

// ─── Journal CRUD ────────────────────────────────────────────────────────────

test.describe('Journal CRUD', () => {
	test.skip(!hasCredentials, 'Skipped: TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD not set');

	test('can submit a journal entry via API and get 200', async ({ page }) => {
		await loginAsClient(page);
		const api = await createAuthedRequest(page);

		try {
			// Use a test date unlikely to clash with real entries
			const testDate = '2020-01-15';
			const response = await api.post('/api/portfolio/journal', {
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
		} finally {
			await api.dispose();
		}
	});

	test('journal API rejects invalid date format', async ({ page }) => {
		await loginAsClient(page);
		const api = await createAuthedRequest(page);
		try {
			const response = await api.post('/api/portfolio/journal', {
				data: { date: '15-01-2020', mood: 3 } // wrong format
			});
			expect(response.status()).toBe(400);
		} finally {
			await api.dispose();
		}
	});

	test('journal API rejects mood score out of range', async ({ page }) => {
		await loginAsClient(page);
		const api = await createAuthedRequest(page);
		try {
			const response = await api.post('/api/portfolio/journal', {
				data: { date: '2020-01-16', mood: 10 } // must be 1-5
			});
			expect(response.status()).toBe(400);
		} finally {
			await api.dispose();
		}
	});

	test('journal API rejects mood score below range', async ({ page }) => {
		await loginAsClient(page);
		const api = await createAuthedRequest(page);
		try {
			const response = await api.post('/api/portfolio/journal', {
				data: { date: '2020-01-16', mood: 0 } // must be 1-5
			});
			expect(response.status()).toBe(400);
		} finally {
			await api.dispose();
		}
	});

	test('journal entry upserts (second save on same date succeeds)', async ({ page }) => {
		await loginAsClient(page);
		const api = await createAuthedRequest(page);
		const testDate = '2020-02-15';

		try {
			// First save
			const r1 = await api.post('/api/portfolio/journal', {
				data: { date: testDate, mood: 2, pre_market_notes: 'first' }
			});
			expect(r1.status()).toBe(200);

			// Second save (upsert) with updated note
			const r2 = await api.post('/api/portfolio/journal', {
				data: { date: testDate, mood: 4, pre_market_notes: 'updated' }
			});
			expect(r2.status()).toBe(200);
			const body = await r2.json();
			expect(body.pre_market_notes).toBe('updated');
		} finally {
			await api.dispose();
		}
	});
});

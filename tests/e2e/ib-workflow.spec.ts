import { test, expect } from '@playwright/test';
import { createAuthedRequest, expectNoServerError, loginWithPassword } from './helpers/auth';

const IB_EMAIL = process.env.TEST_IB_EMAIL;
const IB_PASSWORD = process.env.TEST_IB_PASSWORD;
const hasCredentials = !!IB_EMAIL && !!IB_PASSWORD;

async function loginAsIb(page: import('@playwright/test').Page) {
	await loginWithPassword(page, IB_EMAIL!, IB_PASSWORD!, '**/ib');
}

test.describe('Master IB Workflow', () => {
	test.skip(!hasCredentials, 'Skipped: TEST_IB_EMAIL / TEST_IB_PASSWORD not set');

	test('master IB can log in and land on /ib', async ({ page }) => {
		await loginAsIb(page);
		await expect(page).toHaveURL(/\/ib/);
		await expectNoServerError(page);
	});

	test('/ib/clients loads without error', async ({ page }) => {
		await loginAsIb(page);
		await page.goto('/ib/clients');
		await expect(page).toHaveURL(/\/ib\/clients/);
		await expectNoServerError(page);
	});

	test('/ib/clients/add loads and shows the intake form', async ({ page }) => {
		await loginAsIb(page);
		await page.goto('/ib/clients/add');
		await expect(page).toHaveURL(/\/ib\/clients\/add/);
		await expect(page.getByLabel('ชื่อลูกค้า *')).toBeVisible();
		await expect(page.getByRole('button', { name: 'ถัดไป' })).toBeVisible();
		await expectNoServerError(page);
	});

	test('first accessible client detail loads without crashing', async ({ page }) => {
		await loginAsIb(page);
		await page.goto('/ib/clients');

		const firstClient = page.locator('a[href^="/ib/clients/"]:not([href="/ib/clients/add"])').first();
		if ((await firstClient.count()) === 0) return;

		await firstClient.click();
		await expect(page).toHaveURL(/\/ib\/clients\/.+/);
		await expectNoServerError(page);
	});

	test('master IB cannot open /admin directly', async ({ page }) => {
		await loginAsIb(page);
		await page.goto('/admin');
		await expect(page).not.toHaveURL(/\/admin$/);
	});

	test('master IB invalid portfolio view-as account redirects back to IB area', async ({ page }) => {
		await loginAsIb(page);
		await page.goto('/portfolio?account_id=00000000-0000-0000-0000-000000000000');
		await expect(page).not.toHaveURL(/\/portfolio/);
	});
});

test.describe('Master IB API Validation', () => {
	test.skip(!hasCredentials, 'Skipped: TEST_IB_EMAIL / TEST_IB_PASSWORD not set');

	test('rejects missing required client fields', async ({ page }) => {
		await loginAsIb(page);
		const api = await createAuthedRequest(page);

		try {
			const response = await api.post('/api/ib/clients', {
				data: { client_name: 'QA Candidate' }
			});
			expect(response.status()).toBe(400);
		} finally {
			await api.dispose();
		}
	});

	test('rejects invalid client email format', async ({ page }) => {
		await loginAsIb(page);
		const api = await createAuthedRequest(page);

		try {
			const response = await api.post('/api/ib/clients', {
				data: {
					client_name: 'QA Candidate',
					client_email: 'not-an-email',
					mt5_account_id: '123456',
					mt5_investor_password: 'pass1234',
					mt5_server: 'Connext-Real'
				}
			});
			expect(response.status()).toBe(400);
		} finally {
			await api.dispose();
		}
	});

	test('rejects non-numeric MT5 account ids', async ({ page }) => {
		await loginAsIb(page);
		const api = await createAuthedRequest(page);

		try {
			const response = await api.post('/api/ib/clients', {
				data: {
					client_name: 'QA Candidate',
					client_email: 'qa@example.com',
					mt5_account_id: 'abc123',
					mt5_investor_password: 'pass1234',
					mt5_server: 'Connext-Real'
				}
			});
			expect(response.status()).toBe(400);
		} finally {
			await api.dispose();
		}
	});
});

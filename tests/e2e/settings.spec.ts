import { test, expect } from '@playwright/test';
import { expectNoServerError, loginWithPassword } from './helpers/auth';

const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL;
const CLIENT_PASSWORD = process.env.TEST_CLIENT_PASSWORD;
const hasCredentials = !!CLIENT_EMAIL && !!CLIENT_PASSWORD;

async function loginAsClient(page: import('@playwright/test').Page) {
	await loginWithPassword(page, CLIENT_EMAIL!, CLIENT_PASSWORD!, '**/portfolio');
}

test.describe('Client Settings', () => {
	test.skip(!hasCredentials, 'Skipped: TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD not set');

	test('/settings loads profile and account sections', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/settings');
		await expect(page).toHaveURL(/\/settings/);
		await expect(page.getByRole('heading', { name: 'ตั้งค่า' })).toBeVisible();
		await expect(page.getByText('ข้อมูลโปรไฟล์')).toBeVisible();
		await expectNoServerError(page);
	});

	test('/settings/trade loads trade preferences', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/settings/trade');
		await expect(page).toHaveURL(/\/settings\/trade/);
		await expect(page.getByText('โซนเวลา')).toBeVisible();
		await expectNoServerError(page);
	});

	test('/settings/alerts loads performance alert controls', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/settings/alerts');
		await expect(page).toHaveURL(/\/settings\/alerts/);
		await expect(page.getByText('การแจ้งเตือนประสิทธิภาพ')).toBeVisible();
		await expectNoServerError(page);
	});

	test('/settings/email-reports loads email report controls', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/settings/email-reports');
		await expect(page).toHaveURL(/\/settings\/email-reports/);
		await expect(page.getByText('รายงานทางอีเมล')).toBeVisible();
		await expectNoServerError(page);
	});

	test('/settings/security loads session and password sections', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/settings/security');
		await expect(page).toHaveURL(/\/settings\/security/);
		await expect(page.getByText('เปลี่ยนรหัสผ่าน')).toBeVisible();
		await expect(page.getByText('เซสชันที่ใช้งาน')).toBeVisible();
		await expectNoServerError(page);
	});
});

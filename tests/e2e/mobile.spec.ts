import { test, expect, devices } from '@playwright/test';

test.use({ viewport: devices['iPhone 13'].viewport, userAgent: devices['iPhone 13'].userAgent });

test.describe('Mobile Responsiveness', () => {

	test('login page renders correctly on mobile', async ({ page }) => {
		await page.goto('/auth/login');

		// Title and form should be visible
		await expect(page.locator('h1')).toContainText('IB Portal');
		await expect(page.getByRole('button', { name: /Google/ })).toBeVisible();
		await expect(page.getByLabel('อีเมล')).toBeVisible();

		// Card should fit within mobile viewport
		const card = page.locator('.card').first();
		const box = await card.boundingBox();
		if (box) {
			expect(box.width).toBeLessThanOrEqual(390); // iPhone 13 width
		}
	});

	test('login form is usable on mobile', async ({ page }) => {
		await page.goto('/auth/login');

		// Can interact with form fields
		await page.getByLabel('อีเมล').fill('test@mobile.com');
		await page.getByLabel('รหัสผ่าน').fill('password');

		await expect(page.getByLabel('อีเมล')).toHaveValue('test@mobile.com');
		await expect(page.getByLabel('รหัสผ่าน')).toHaveValue('password');
	});
});

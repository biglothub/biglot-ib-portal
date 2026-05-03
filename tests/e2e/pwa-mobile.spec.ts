import { test, expect, devices } from '@playwright/test';

test.use({ viewport: devices['iPhone 13'].viewport, userAgent: devices['iPhone 13'].userAgent });

test.describe('PWA mobile shell', () => {
	test('manifest is installable and launches with PWA source marker', async ({ request }) => {
		const response = await request.get('/manifest.json');
		expect(response.ok()).toBe(true);
		const manifest = await response.json();
		expect(manifest.display).toBe('standalone');
		expect(manifest.start_url).toBe('/?source=pwa');
		expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true);
	});

	test('offline page exposes reconnect and cached navigation actions', async ({ page }) => {
		await page.goto('/offline');
		await expect(page.getByRole('heading', { name: 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'ลองเชื่อมต่อใหม่' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'เปิดหน้าพอร์ต' })).toBeVisible();
	});
});

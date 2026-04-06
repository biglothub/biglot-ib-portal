import { expect, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173';

export async function loginWithPassword(
	page: Page,
	email: string,
	password: string,
	destination: RegExp | string
) {
	await page.goto('/auth/login');
	await page.getByLabel(/อีเมล/i).fill(email);
	await page.getByLabel(/รหัสผ่าน/i).fill(password);
	await page.getByRole('button', { name: /เข้าสู่ระบบ/i }).click();
	await page.waitForURL(destination, { timeout: 15_000 });
}

export async function createAuthedRequest(page: Page): Promise<APIRequestContext> {
	const storageState = await page.context().storageState();

	return playwrightRequest.newContext({
		baseURL: BASE_URL,
		storageState
	});
}

export async function expectNoServerError(page: Page) {
	await expect(page.locator('body')).not.toContainText('Internal Server Error');
	await expect(page.locator('body')).not.toContainText('500');
	await expect(page.locator('body')).not.toContainText('NaN');
	await expect(page.locator('body')).not.toContainText('undefined');
}

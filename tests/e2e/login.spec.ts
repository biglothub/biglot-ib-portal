import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/auth/login');
	});

	test('renders login page with correct title', async ({ page }) => {
		await expect(page).toHaveTitle(/Login/);
		await expect(page.locator('h1')).toContainText('IB Portal');
	});

	test('shows Google sign-in button', async ({ page }) => {
		const googleBtn = page.getByRole('button', { name: /Google/ });
		await expect(googleBtn).toBeVisible();
		await expect(googleBtn).toContainText('เข้าสู่ระบบด้วย Google');
	});

	test('shows email/password form for Admin/IB', async ({ page }) => {
		await expect(page.getByLabel('อีเมล')).toBeVisible();
		await expect(page.getByLabel('รหัสผ่าน')).toBeVisible();
		await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true })).toBeVisible();
	});

	test('shows admin/IB divider text', async ({ page }) => {
		await expect(page.getByText('สำหรับ Admin / IB')).toBeVisible();
	});

	test('email field requires valid email', async ({ page }) => {
		const emailInput = page.getByLabel('อีเมล');
		await expect(emailInput).toHaveAttribute('type', 'email');
		await expect(emailInput).toHaveAttribute('required', '');
	});

	test('password field is masked', async ({ page }) => {
		const passwordInput = page.getByLabel('รหัสผ่าน');
		await expect(passwordInput).toHaveAttribute('type', 'password');
		await expect(passwordInput).toHaveAttribute('required', '');
	});

	test('submit button shows loading state on click', async ({ page }) => {
		const context = page.context();
		await context.addInitScript(() => {
			const originalFetch = window.fetch.bind(window);

			window.fetch = async (input, init) => {
				const url = typeof input === 'string'
					? input
					: input instanceof Request
						? input.url
						: String(input);

				if (url.includes('/auth/v1/token')) {
					await new Promise((resolve) => setTimeout(resolve, 1500));
					throw new Error('Synthetic auth delay');
				}

				return originalFetch(input, init);
			};
		});

		const loginPage = await context.newPage();
		try {
			await loginPage.goto('/auth/login');
			await loginPage.getByLabel('อีเมล').fill('test@example.com');
			await loginPage.getByLabel('รหัสผ่าน').fill('password123');

			const submitBtn = loginPage.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true });
			await submitBtn.click();

			// Button should show loading text while request is in-flight
			await expect(loginPage.getByRole('button', { name: /กำลังเข้าสู่ระบบ/i })).toBeVisible();
		} finally {
			await loginPage.close();
		}
	});

	test('displays error from URL params', async ({ page }) => {
		await page.goto('/auth/login?error=no_account');
		await expect(page.getByText('ไม่พบบัญชีที่ได้รับอนุมัติสำหรับอีเมลนี้')).toBeVisible();
	});

	test('displays Google auth error from URL params', async ({ page }) => {
		await page.goto('/auth/login?error=google_auth_failed');
		await expect(page.getByText('การเข้าสู่ระบบด้วย Google ล้มเหลว')).toBeVisible();
	});
});

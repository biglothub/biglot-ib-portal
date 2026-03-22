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
		await expect(page.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeVisible();
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
		await page.getByLabel('อีเมล').fill('test@example.com');
		await page.getByLabel('รหัสผ่าน').fill('password123');

		const submitBtn = page.getByRole('button', { name: 'เข้าสู่ระบบ' });
		await submitBtn.click();

		// Button should show loading text briefly
		await expect(submitBtn).toContainText('กำลังเข้าสู่ระบบ');
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

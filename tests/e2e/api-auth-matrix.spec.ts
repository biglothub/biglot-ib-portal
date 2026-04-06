import { test, expect } from '@playwright/test';

const protectedRequests: Array<{
	method: 'post' | 'put' | 'delete' | 'get';
	path: string;
	data?: Record<string, unknown>;
}> = [
	{
		method: 'post',
		path: '/api/admin/clients/edit',
		data: { client_account_id: 'test', client_name: 'Test Client' }
	},
	{
		method: 'post',
		path: '/api/admin/clients/delete',
		data: { client_account_id: 'test' }
	},
	{
		method: 'post',
		path: '/api/admin/reset-password',
		data: { user_id: 'test' }
	},
	{
		method: 'post',
		path: '/api/ib/clients/edit',
		data: { client_account_id: 'test', client_name: 'Test Client' }
	},
	{
		method: 'post',
		path: '/api/ib/clients/resubmit',
		data: {
			client_account_id: 'test',
			mt5_account_id: '123456',
			mt5_investor_password: 'pass1234',
			mt5_server: 'Connext-Real'
		}
	},
	{
		method: 'post',
		path: '/api/ib/clients/cancel',
		data: { client_account_id: 'test' }
	},
	{
		method: 'post',
		path: '/api/settings/profile',
		data: { action: 'update_name', full_name: 'Test User' }
	},
	{
		method: 'post',
		path: '/api/settings/security',
		data: { action: 'change_password', current_password: 'oldpass', new_password: 'newpass123' }
	},
	{
		method: 'post',
		path: '/api/settings/trade',
		data: { timezone: 'Asia/Bangkok', default_tp_pips: 50, default_sl_pips: 30, symbol_settings: [] }
	},
	{
		method: 'post',
		path: '/api/push/send',
		data: { userId: 'test-user', title: 'Test notification' }
	},
	{
		method: 'post',
		path: '/api/portfolio/api-keys',
		data: { name: 'QA Key' }
	},
	{
		method: 'delete',
		path: '/api/portfolio/api-keys',
		data: { id: 'test-key' }
	},
	{
		method: 'get',
		path: '/api/portfolio/export'
	}
];

test.describe('Expanded Auth Matrix', () => {
	for (const requestCase of protectedRequests) {
		test(`${requestCase.method.toUpperCase()} ${requestCase.path} without auth redirects to login`, async ({ request }) => {
			const response = await request.fetch(requestCase.path, {
				method: requestCase.method.toUpperCase(),
				data: requestCase.data
			});

			expect(response.url()).toContain('/auth/login');
		});
	}
});

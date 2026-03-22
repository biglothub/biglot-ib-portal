import { test, expect } from '@playwright/test';

test.describe('Health Check API', () => {
	test('GET /api/health returns a response', async ({ request }) => {
		const response = await request.get('/api/health');
		// May return 200 (healthy) or 503 (unhealthy if no DB) — both are valid responses
		expect([200, 503]).toContain(response.status());

		const body = await response.json();
		expect(body).toHaveProperty('status');
		expect(['healthy', 'unhealthy']).toContain(body.status);
	});

	test('GET /api/health includes expected fields', async ({ request }) => {
		const response = await request.get('/api/health');
		const body = await response.json();

		expect(body).toHaveProperty('timestamp');
		expect(typeof body.timestamp).toBe('string');
		expect(body).toHaveProperty('uptime_seconds');
		expect(typeof body.uptime_seconds).toBe('number');
		expect(body).toHaveProperty('database');
		expect(body.database).toHaveProperty('status');
	});
});

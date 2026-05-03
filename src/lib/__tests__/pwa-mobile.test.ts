import { describe, expect, it } from 'vitest';
import { canQueue } from '$lib/pwa/sync-allowlist';

describe('PWA sync allowlist', () => {
	it('allows low-risk journal and review writes', () => {
		expect(canQueue({ method: 'POST', endpoint: '/api/portfolio/journal' })).toBe(true);
		expect(canQueue({ method: 'POST', endpoint: '/api/portfolio/trades/trade-1/review' })).toBe(true);
		expect(canQueue({ method: 'PATCH', endpoint: '/api/portfolio/trades/trade-1/review' })).toBe(true);
	});

	it('denies destructive and admin workflows', () => {
		expect(canQueue({ method: 'DELETE', endpoint: '/api/portfolio/trades/trade-1/review' })).toBe(false);
		expect(canQueue({ method: 'POST', endpoint: '/api/admin/approve' })).toBe(false);
		expect(canQueue({ method: 'POST', endpoint: '/api/admin/clients/delete' })).toBe(false);
		expect(canQueue({ method: 'POST', endpoint: '/api/ib/clients/client-1/approve' })).toBe(false);
	});

	it('requires exact supported endpoint patterns', () => {
		expect(canQueue({ method: 'POST', endpoint: '/api/portfolio/trades' })).toBe(false);
		expect(canQueue({ method: 'POST', endpoint: '/api/portfolio/trades/trade-1/tags' })).toBe(false);
		expect(canQueue({ method: 'GET', endpoint: '/api/portfolio/journal' })).toBe(false);
	});
});

describe('PWA install and sync constants', () => {
	it('uses the shared localStorage key for pending sync count', async () => {
		const { PWA_PENDING_COUNT_KEY } = await import('$lib/pwa/sync-queue');
		expect(PWA_PENDING_COUNT_KEY).toBe('pwa.pending.count');
	});

	it('uses the shared install snooze key', async () => {
		const { PWA_INSTALL_DISMISSED_AT_KEY } = await import('$lib/pwa/install-event.svelte');
		expect(PWA_INSTALL_DISMISSED_AT_KEY).toBe('pwa.install.dismissedAt');
	});
});

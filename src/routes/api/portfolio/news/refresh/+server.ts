import { rateLimit } from '$lib/server/rate-limit';
import { canRefresh, refreshNews } from '$lib/server/news';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
	}

	// Global rate limit: 1 refresh per 5 minutes across all users
	if (!rateLimit('news-refresh-global', 1, 300_000)) {
		return new Response(
			JSON.stringify({ message: 'News was recently refreshed', newArticles: 0 }),
			{ status: 200 }
		);
	}

	if (!canRefresh()) {
		return new Response(
			JSON.stringify({ message: 'Refresh cooldown active', newArticles: 0 }),
			{ status: 200 }
		);
	}

	try {
		const result = await refreshNews();
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (err: unknown) {
		console.error('News refresh error:', err);
		return new Response(
			JSON.stringify({ message: 'Failed to refresh news', error: err instanceof Error ? err.message : 'Unknown error' }),
			{ status: 500 }
		);
	}
};

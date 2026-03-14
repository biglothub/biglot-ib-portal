import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.profile) {
		return new Response(JSON.stringify({ articles: [] }), { status: 401 });
	}

	const oneDayAgo = new Date();
	oneDayAgo.setDate(oneDayAgo.getDate() - 1);

	const { data } = await locals.supabase
		.from('market_news')
		.select('*')
		.eq('ai_processed', true)
		.gte('published_at', oneDayAgo.toISOString())
		.order('relevance_score', { ascending: false })
		.order('published_at', { ascending: false })
		.limit(20);

	return new Response(JSON.stringify({ articles: data || [] }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const parentData = await parent();
	const account = parentData.account;
	const profile = locals.profile;

	if (!account || !profile) {
		return { cachedAnalysis: null };
	}

	const today = new Date().toISOString().split('T')[0];

	const { data: cachedAnalysis } = await locals.supabase
		.from('market_analyses')
		.select('id, sections, created_at')
		.eq('user_id', profile.id)
		.eq('client_account_id', account.id)
		.eq('symbol', 'XAUUSD')
		.eq('analysis_date', today)
		.maybeSingle();

	return { cachedAnalysis };
};

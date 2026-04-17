import { getBangkokToday } from '$lib/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const parentData = await parent();
	const { account, userId } = parentData;
	const profile = locals.profile;

	if (!account || !profile || !userId) {
		return { cachedAnalysis: null };
	}

	const today = getBangkokToday();

	const { data: cachedAnalysis } = await locals.supabase
		.from('market_analyses')
		.select('id, sections, created_at')
		.eq('user_id', userId)
		.eq('client_account_id', account.id)
		.eq('symbol', 'XAUUSD')
		.eq('analysis_date', today)
		.maybeSingle();

	return { cachedAnalysis };
};

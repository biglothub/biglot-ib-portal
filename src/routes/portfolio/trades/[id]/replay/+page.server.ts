import { fetchTradeChartContext } from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const parentData = await parent();
	const { account } = parentData;
	const supabase = locals.supabase;
	const profile = locals.profile;

	if (!account || !profile) {
		return { trade: null, chartContexts: [] };
	}

	const [tradeRes, chartContexts] = await Promise.all([
		supabase
			.from('trades')
			.select('id, symbol, type, lot_size, open_price, close_price, open_time, close_time, profit, sl, tp, pips, commission, swap')
			.eq('id', params.id)
			.eq('client_account_id', account.id)
			.single(),
		fetchTradeChartContext(supabase, params.id)
	]);

	return {
		trade: tradeRes.data || null,
		chartContexts
	};
};

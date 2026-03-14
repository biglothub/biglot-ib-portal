import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const { account } = await parent();
	const supabase = locals.supabase;

	if (!account) {
		return { trade: null, relatedTrades: [] };
	}

	// Fetch single trade with tags and notes
	const { data: trade } = await supabase
		.from('trades')
		.select('*, trade_tag_assignments(id, tag_id, trade_tags(id, name, color, category)), trade_notes(id, content, rating, updated_at)')
		.eq('id', params.id)
		.eq('client_account_id', account.id)
		.single();

	if (!trade) {
		return { trade: null, relatedTrades: [] };
	}

	// Fetch related trades (same symbol, recent)
	const { data: relatedTrades } = await supabase
		.from('trades')
		.select('id, symbol, type, profit, lot_size, close_time')
		.eq('client_account_id', account.id)
		.eq('symbol', trade.symbol)
		.neq('id', trade.id)
		.order('close_time', { ascending: false })
		.limit(5);

	return {
		trade,
		relatedTrades: relatedTrades || []
	};
};

import type { PageServerLoad } from './$types';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const { account } = await parent();
	const supabase = locals.supabase;

	if (!account) {
		return { trades: [], total: 0, page: 1, pageSize: PAGE_SIZE, symbols: [], filters: {} };
	}

	// Parse filters from URL search params
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const symbol = url.searchParams.get('symbol') || '';
	const type = url.searchParams.get('type') || '';
	const result = url.searchParams.get('result') || '';
	const from = url.searchParams.get('from') || '';
	const to = url.searchParams.get('to') || '';
	const tagId = url.searchParams.get('tag') || '';

	const filters = { symbol, type, result, from, to, tagId };

	// Get distinct symbols for filter dropdown
	const { data: symbolsData } = await supabase
		.from('trades')
		.select('symbol')
		.eq('client_account_id', account.id)
		.order('symbol');

	const symbols = [...new Set((symbolsData || []).map((s: any) => s.symbol))];

	// Build trade query with filters
	let query = supabase
		.from('trades')
		.select('*, trade_tag_assignments(id, tag_id, trade_tags(id, name, color, category)), trade_notes(id, content, rating)', { count: 'exact' })
		.eq('client_account_id', account.id);

	if (symbol) {
		query = query.eq('symbol', symbol);
	}
	if (type === 'BUY' || type === 'SELL') {
		query = query.eq('type', type);
	}
	if (result === 'win') {
		query = query.gt('profit', 0);
	} else if (result === 'loss') {
		query = query.lt('profit', 0);
	} else if (result === 'breakeven') {
		query = query.eq('profit', 0);
	}
	if (from) {
		query = query.gte('close_time', from);
	}
	if (to) {
		query = query.lte('close_time', to + 'T23:59:59');
	}

	// Order and paginate
	query = query
		.order('close_time', { ascending: false })
		.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

	const { data: trades, count, error } = await query;

	// If tag filter is set, filter client-side (Supabase doesn't support filtering by nested relation easily)
	let filteredTrades = trades || [];
	let filteredCount = count || 0;

	if (tagId && filteredTrades.length > 0) {
		filteredTrades = filteredTrades.filter((t: any) =>
			t.trade_tag_assignments?.some((a: any) => a.tag_id === tagId)
		);
		filteredCount = filteredTrades.length;
	}

	return {
		trades: filteredTrades,
		total: filteredCount,
		page,
		pageSize: PAGE_SIZE,
		symbols,
		filters
	};
};

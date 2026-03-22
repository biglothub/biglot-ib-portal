import { fetchTradeChartContext } from '$lib/server/portfolio';
import { evaluateTradeInsights, calculateQualityScore, calculateExecutionMetrics } from '$lib/server/insights/engine';
import { toThaiDateString } from '$lib/utils';
import type { Trade } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const parentData = await parent();
	const { account, playbooks = [], userId } = parentData;
	const supabase = locals.supabase;
	const profile = locals.profile;

	if (!account || !profile || !userId) {
		return { trade: null, relatedTrades: [], chartContexts: [], dayJournal: null, playbooks: [] };
	}

	const { data: trade } = await supabase
		.from('trades')
		.select(
			'*, trade_tag_assignments(id, tag_id, trade_tags(id, name, color, category)), trade_notes(id, content, rating, updated_at), trade_reviews(*, playbooks(id, name, description)), trade_attachments(*)'
		)
		.eq('id', params.id)
		.eq('client_account_id', account.id)
		.single();

	if (!trade) {
		return { trade: null, relatedTrades: [], chartContexts: [], dayJournal: null, playbooks };
	}

	const currentPlaybookId = trade.trade_reviews?.[0]?.playbook_id || null;

	// Build similar trades query with DB-level filtering when possible
	let similarQuery = supabase
		.from('trades')
		.select('id, symbol, type, profit, close_time, trade_reviews(review_status, playbook_id), trade_tag_assignments(tag_id, trade_tags(id, name, color, category))')
		.eq('client_account_id', account.id)
		.neq('id', trade.id)
		.order('close_time', { ascending: false })
		.limit(20);

	if (currentPlaybookId) {
		similarQuery = similarQuery.not('trade_reviews', 'is', null);
	}

	const [relatedTradesRes, chartContexts, journalRes, similarReviewRes] = await Promise.all([
		supabase
			.from('trades')
			.select(
				'id, symbol, type, profit, lot_size, close_time, trade_reviews(review_status, playbook_id), trade_tag_assignments(tag_id, trade_tags(id, name, color, category))'
			)
			.eq('client_account_id', account.id)
			.eq('symbol', trade.symbol)
			.neq('id', trade.id)
			.order('close_time', { ascending: false })
			.limit(6),
		fetchTradeChartContext(supabase, trade.id),
		supabase
			.from('daily_journal')
			.select('*')
			.eq('client_account_id', account.id)
			.eq('user_id', userId)
			.eq('date', toThaiDateString(trade.close_time))
			.maybeSingle(),
		similarQuery
	]);

	type SimilarTradeRow = {
		trade_reviews?: Array<{ playbook_id?: string | null }>;
		trade_tag_assignments?: Array<{ tag_id: string }>;
	};
	const similarReviewedTrades = (similarReviewRes.data as SimilarTradeRow[] || []).filter((item) =>
		currentPlaybookId
			? item.trade_reviews?.[0]?.playbook_id === currentPlaybookId
			: (item.trade_tag_assignments || []).some((assignment) =>
					(trade.trade_tag_assignments || []).some((current) => current.tag_id === assignment.tag_id)
				)
	).slice(0, 5);

	// Compute insights for this trade using all related trades as context
	const allTradesForContext = [...(relatedTradesRes.data as Trade[] || []), trade];
	const insights = evaluateTradeInsights(trade, allTradesForContext);

	// Build context for quality score
	const symbolTrades = allTradesForContext.filter((t: Trade) => t.symbol === trade.symbol);
	const symbolWins = symbolTrades.filter((t: Trade) => Number(t.profit || 0) > 0);
	const symbolLosses = symbolTrades.filter((t: Trade) => Number(t.profit || 0) < 0);
	const qualityScore = calculateQualityScore(trade, {
		allTrades: allTradesForContext,
		symbolTrades,
		avgSymbolWin: symbolWins.length > 0 ? symbolWins.reduce((s: number, t: Trade) => s + Number(t.profit || 0), 0) / symbolWins.length : 0,
		avgSymbolLoss: symbolLosses.length > 0 ? Math.abs(symbolLosses.reduce((s: number, t: Trade) => s + Number(t.profit || 0), 0)) / symbolLosses.length : 0,
		avgSymbolHoldMinutes: symbolTrades.length > 0 ? symbolTrades.reduce((s: number, t: Trade) => s + (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 60000, 0) / symbolTrades.length : 0,
	});

	const executionMetrics = calculateExecutionMetrics(trade);

	return {
		trade,
		relatedTrades: relatedTradesRes.data || [],
		chartContexts,
		dayJournal: journalRes.data || null,
		playbooks,
		similarReviewedTrades,
		insights,
		qualityScore,
		executionMetrics
	};
};

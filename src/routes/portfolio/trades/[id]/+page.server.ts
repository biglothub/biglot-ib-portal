import { fetchTradeChartContext } from '$lib/server/portfolio';
import { evaluateTradeInsights, calculateQualityScore } from '$lib/server/insights/engine';
import { toThaiDateString } from '$lib/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params, locals }) => {
	const parentData = await parent();
	const { account, playbooks = [] } = parentData;
	const supabase = locals.supabase;
	const profile = locals.profile;

	if (!account || !profile) {
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
			.eq('user_id', profile.id)
			.eq('date', toThaiDateString(trade.close_time))
			.maybeSingle(),
		supabase
			.from('trades')
			.select('id, symbol, type, profit, close_time, trade_reviews(review_status, playbook_id), trade_tag_assignments(tag_id, trade_tags(id, name, color, category))')
			.eq('client_account_id', account.id)
			.order('close_time', { ascending: false })
			.limit(20)
	]);

	const currentPlaybookId = trade.trade_reviews?.[0]?.playbook_id || null;
	const similarReviewedTrades = (similarReviewRes.data || []).filter((item: any) =>
		item.id !== trade.id &&
		currentPlaybookId
			? item.trade_reviews?.[0]?.playbook_id === currentPlaybookId
			: (item.trade_tag_assignments || []).some((assignment: any) =>
					(trade.trade_tag_assignments || []).some((current: any) => current.tag_id === assignment.tag_id)
				)
	).slice(0, 5);

	// Compute insights for this trade using all related trades as context
	const allTradesForContext = [...(relatedTradesRes.data || []), trade];
	const insights = evaluateTradeInsights(trade, allTradesForContext);

	// Build context for quality score
	const symbolTrades = allTradesForContext.filter((t: any) => t.symbol === trade.symbol);
	const symbolWins = symbolTrades.filter((t: any) => Number(t.profit || 0) > 0);
	const symbolLosses = symbolTrades.filter((t: any) => Number(t.profit || 0) < 0);
	const qualityScore = calculateQualityScore(trade, {
		allTrades: allTradesForContext,
		symbolTrades,
		avgSymbolWin: symbolWins.length > 0 ? symbolWins.reduce((s: number, t: any) => s + Number(t.profit || 0), 0) / symbolWins.length : 0,
		avgSymbolLoss: symbolLosses.length > 0 ? Math.abs(symbolLosses.reduce((s: number, t: any) => s + Number(t.profit || 0), 0)) / symbolLosses.length : 0,
		avgSymbolHoldMinutes: symbolTrades.length > 0 ? symbolTrades.reduce((s: number, t: any) => s + (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 60000, 0) / symbolTrades.length : 0,
	});

	return {
		trade,
		relatedTrades: relatedTradesRes.data || [],
		chartContexts,
		dayJournal: journalRes.data || null,
		playbooks,
		similarReviewedTrades,
		insights,
		qualityScore
	};
};

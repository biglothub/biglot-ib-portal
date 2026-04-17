import { getTradeDurationBucket, getTradeDurationMinutes, getTradeReview, getTradeReviewStatus, getTradeSession, parsePortfolioFilters } from '$lib/portfolio';
import { buildAnalyticsViewData } from '$lib/server/analytics-export';
import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { fetchPortfolioBaseData } from '$lib/server/portfolio';
import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import type { Trade, TradeTagAssignment, TradeTag } from '$lib/types';
import type { RequestHandler } from './$types';

function csvCell(value: unknown): string {
	return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function boolFlag(value: boolean | null | undefined): string {
	if (value === true) return 'yes';
	if (value === false) return 'no';
	return '';
}

function mapTagsByCategory(assignments: TradeTagAssignment[] = []) {
	const result: Record<string, string[]> = {
		setup: [],
		execution: [],
		emotion: [],
		mistake: [],
		market_condition: [],
		custom: []
	};

	for (const assignment of assignments) {
		const tag = assignment.trade_tags as TradeTag | undefined;
		if (!tag?.name || !tag.category) continue;
		result[tag.category] = [...(result[tag.category] || []), tag.name];
	}

	return result;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:analytics-export-csv:${profile.id}`, 5, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	const filterState = parsePortfolioFilters(url.searchParams);
	const baseData = await fetchPortfolioBaseData(locals.supabase, account.id, profile.id);
	const analyticsView = buildAnalyticsViewData(baseData, filterState);
	const { report } = analyticsView;

	const columns = [
		'Close Date',
		'Close Time',
		'Open Time',
		'Day Of Week',
		'Session',
		'Duration Bucket',
		'Hold Minutes',
		'Symbol',
		'Side',
		'Outcome',
		'Lot Size',
		'Open Price',
		'Close Price',
		'SL',
		'TP',
		'Profit',
		'Pips',
		'Commission',
		'Swap',
		'Position ID',
		'Review Status',
		'Playbook',
		'Playbook ID',
		'Setup Quality Score',
		'Discipline Score',
		'Execution Score',
		'Confidence At Entry',
		'Followed Plan',
		'Broken Rules Count',
		'Broken Rules',
		'Entry Reason',
		'Exit Reason',
		'Execution Notes',
		'Risk Notes',
		'Mistake Summary',
		'Lesson Summary',
		'Next Action',
		'Reviewed At',
		'Has Notes',
		'Notes Count',
		'Notes',
		'Has Attachments',
		'Attachments Count',
		'Attachment Kinds',
		'Attachment Captions',
		'All Tags',
		'Setup Tags',
		'Execution Tags',
		'Emotion Tags',
		'Mistake Tags',
		'Market Condition Tags',
		'Custom Tags'
	];

	const rows = report.filteredTrades.map((trade: Trade) => {
		const review = getTradeReview(trade);
		const tagNames = (trade.trade_tag_assignments || [])
			.map((assignment) => assignment.trade_tags?.name)
			.filter(Boolean) as string[];
		const tagsByCategory = mapTagsByCategory(trade.trade_tag_assignments || []);
		const notes = trade.trade_notes || [];
		const attachments = trade.trade_attachments || [];
		const closeDate = trade.close_time ? String(trade.close_time).split('T')[0] : '';

		return [
			closeDate,
			trade.close_time,
			trade.open_time,
			trade.close_time ? new Date(trade.close_time).toLocaleDateString('en-US', { weekday: 'short' }) : '',
			getTradeSession(trade.close_time),
			getTradeDurationBucket(trade.open_time, trade.close_time),
			getTradeDurationMinutes(trade.open_time, trade.close_time),
			trade.symbol,
			trade.type,
			Number(trade.profit || 0) > 0 ? 'win' : Number(trade.profit || 0) < 0 ? 'loss' : 'breakeven',
			trade.lot_size,
			trade.open_price,
			trade.close_price,
			trade.sl ?? '',
			trade.tp ?? '',
			trade.profit,
			trade.pips ?? '',
			trade.commission,
			trade.swap,
			trade.position_id,
			getTradeReviewStatus(trade),
			review?.playbooks?.name || '',
			review?.playbook_id || '',
			review?.setup_quality_score ?? '',
			review?.discipline_score ?? '',
			review?.execution_score ?? '',
			review?.confidence_at_entry ?? '',
			boolFlag(review?.followed_plan),
			review?.broken_rules?.length ?? 0,
			(review?.broken_rules || []).join(' | '),
			review?.entry_reason || '',
			review?.exit_reason || '',
			review?.execution_notes || '',
			review?.risk_notes || '',
			review?.mistake_summary || '',
			review?.lesson_summary || '',
			review?.next_action || '',
			review?.reviewed_at || '',
			notes.length > 0 ? 'yes' : 'no',
			notes.length,
			notes.map((note) => note.content).filter(Boolean).join(' || '),
			attachments.length > 0 ? 'yes' : 'no',
			attachments.length,
			attachments.map((attachment) => attachment.kind).filter(Boolean).join(' | '),
			attachments.map((attachment) => attachment.caption).filter(Boolean).join(' | '),
			tagNames.join(' | '),
			tagsByCategory.setup.join(' | '),
			tagsByCategory.execution.join(' | '),
			tagsByCategory.emotion.join(' | '),
			tagsByCategory.mistake.join(' | '),
			tagsByCategory.market_condition.join(' | '),
			tagsByCategory.custom.join(' | ')
		];
	});

	const csvContent = [columns, ...rows]
		.map((row) => row.map((cell) => csvCell(cell)).join(','))
		.join('\n');

	const filename = `analytics-trades-${new Date().toISOString().slice(0, 10)}.csv`;

	return new Response('\uFEFF' + csvContent, {
		status: 200,
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'no-store'
		}
	});
};

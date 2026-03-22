import type { PortfolioFilterState, ReviewStatus, Trade } from '$lib/types';
import { THAILAND_OFFSET_MS } from '$lib/utils';

export const EMPTY_PORTFOLIO_FILTERS: PortfolioFilterState = {
	q: '',
	from: '',
	to: '',
	symbols: [],
	sessions: [],
	directions: [],
	tagIds: [],
	playbookIds: [],
	reviewStatus: [],
	outcome: '',
	hasNotes: null,
	hasAttachments: null,
	durationBucket: '',
	profitMin: null,
	profitMax: null,
	lotSizeMin: null,
	lotSizeMax: null,
	pipsMin: null,
	pipsMax: null,
	qualityScoreMin: null,
	qualityScoreMax: null,
	disciplineScoreMin: null,
	disciplineScoreMax: null,
	executionScoreMin: null,
	executionScoreMax: null,
	confidenceMin: null,
	confidenceMax: null,
	followedPlan: '',
	hasBrokenRules: '',
	dayOfWeek: []
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
	unreviewed: 'ยังไม่รีวิว',
	in_progress: 'กำลังรีวิว',
	reviewed: 'รีวิวแล้ว'
};

export const REVIEW_STATUS_STYLES: Record<ReviewStatus, string> = {
	unreviewed: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
	in_progress: 'bg-brand-primary/10 text-brand-300 border-brand-primary/20',
	reviewed: 'bg-green-500/10 text-green-300 border-green-500/20'
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseNumParam(value: string | null): number | null {
	if (value == null || value === '') return null;
	const n = parseFloat(value);
	return isNaN(n) ? null : n;
}

export function parsePortfolioFilters(searchParams: URLSearchParams): PortfolioFilterState {
	const parseBool = (value: string | null) => {
		if (value == null || value === '') return null;
		return value === '1' || value === 'true';
	};

	const outcome = searchParams.get('outcome');
	const durationBucket = searchParams.get('duration');
	const rawFrom = searchParams.get('from') || '';
	const rawTo = searchParams.get('to') || '';
	const followedPlan = searchParams.get('followed_plan');
	const hasBrokenRules = searchParams.get('has_broken_rules');

	return {
		q: searchParams.get('q') || '',
		from: DATE_RE.test(rawFrom) ? rawFrom : '',
		to: DATE_RE.test(rawTo) ? rawTo : '',
		symbols: searchParams.getAll('symbol'),
		sessions: searchParams.getAll('session'),
		directions: searchParams.getAll('direction'),
		tagIds: searchParams.getAll('tag'),
		playbookIds: searchParams.getAll('playbook'),
		reviewStatus: searchParams.getAll('review_status') as ReviewStatus[],
		outcome: outcome === 'win' || outcome === 'loss' || outcome === 'breakeven' ? outcome : '',
		hasNotes: parseBool(searchParams.get('has_notes')),
		hasAttachments: parseBool(searchParams.get('has_attachments')),
		durationBucket:
			durationBucket === 'scalp' ||
			durationBucket === 'intraday' ||
			durationBucket === 'swing' ||
			durationBucket === 'position'
				? durationBucket
				: '',
		profitMin: parseNumParam(searchParams.get('profit_min')),
		profitMax: parseNumParam(searchParams.get('profit_max')),
		lotSizeMin: parseNumParam(searchParams.get('lot_min')),
		lotSizeMax: parseNumParam(searchParams.get('lot_max')),
		pipsMin: parseNumParam(searchParams.get('pips_min')),
		pipsMax: parseNumParam(searchParams.get('pips_max')),
		qualityScoreMin: parseNumParam(searchParams.get('quality_min')),
		qualityScoreMax: parseNumParam(searchParams.get('quality_max')),
		disciplineScoreMin: parseNumParam(searchParams.get('discipline_min')),
		disciplineScoreMax: parseNumParam(searchParams.get('discipline_max')),
		executionScoreMin: parseNumParam(searchParams.get('execution_min')),
		executionScoreMax: parseNumParam(searchParams.get('execution_max')),
		confidenceMin: parseNumParam(searchParams.get('confidence_min')),
		confidenceMax: parseNumParam(searchParams.get('confidence_max')),
		followedPlan: followedPlan === 'yes' || followedPlan === 'no' ? followedPlan : '',
		hasBrokenRules: hasBrokenRules === 'yes' || hasBrokenRules === 'no' ? hasBrokenRules : '',
		dayOfWeek: searchParams.getAll('dow').map(Number).filter((n) => n >= 0 && n <= 6 && Number.isInteger(n))
	};
}

export function buildPortfolioSearchParams(filters: PortfolioFilterState): URLSearchParams {
	const params = new URLSearchParams();
	if (filters.q) params.set('q', filters.q);
	if (filters.from) params.set('from', filters.from);
	if (filters.to) params.set('to', filters.to);
	for (const symbol of filters.symbols) params.append('symbol', symbol);
	for (const session of filters.sessions) params.append('session', session);
	for (const direction of filters.directions) params.append('direction', direction);
	for (const tagId of filters.tagIds) params.append('tag', tagId);
	for (const playbookId of filters.playbookIds) params.append('playbook', playbookId);
	for (const status of filters.reviewStatus) params.append('review_status', status);
	if (filters.outcome) params.set('outcome', filters.outcome);
	if (filters.hasNotes != null) params.set('has_notes', filters.hasNotes ? '1' : '0');
	if (filters.hasAttachments != null) params.set('has_attachments', filters.hasAttachments ? '1' : '0');
	if (filters.durationBucket) params.set('duration', filters.durationBucket);
	if (filters.profitMin != null) params.set('profit_min', String(filters.profitMin));
	if (filters.profitMax != null) params.set('profit_max', String(filters.profitMax));
	if (filters.lotSizeMin != null) params.set('lot_min', String(filters.lotSizeMin));
	if (filters.lotSizeMax != null) params.set('lot_max', String(filters.lotSizeMax));
	if (filters.pipsMin != null) params.set('pips_min', String(filters.pipsMin));
	if (filters.pipsMax != null) params.set('pips_max', String(filters.pipsMax));
	if (filters.qualityScoreMin != null) params.set('quality_min', String(filters.qualityScoreMin));
	if (filters.qualityScoreMax != null) params.set('quality_max', String(filters.qualityScoreMax));
	if (filters.disciplineScoreMin != null) params.set('discipline_min', String(filters.disciplineScoreMin));
	if (filters.disciplineScoreMax != null) params.set('discipline_max', String(filters.disciplineScoreMax));
	if (filters.executionScoreMin != null) params.set('execution_min', String(filters.executionScoreMin));
	if (filters.executionScoreMax != null) params.set('execution_max', String(filters.executionScoreMax));
	if (filters.confidenceMin != null) params.set('confidence_min', String(filters.confidenceMin));
	if (filters.confidenceMax != null) params.set('confidence_max', String(filters.confidenceMax));
	if (filters.followedPlan) params.set('followed_plan', filters.followedPlan);
	if (filters.hasBrokenRules) params.set('has_broken_rules', filters.hasBrokenRules);
	for (const dow of filters.dayOfWeek) params.append('dow', String(dow));
	return params;
}

export function getTradeReview(trade: Trade) {
	return trade.trade_reviews?.[0] || null;
}

export function getTradeReviewStatus(trade: Trade): ReviewStatus {
	return getTradeReview(trade)?.review_status || 'unreviewed';
}

export function getTradeNotes(trade: Trade) {
	return trade.trade_notes || [];
}

export function getTradeAttachments(trade: Trade) {
	return trade.trade_attachments || [];
}

export function getTradePlaybookId(trade: Trade): string | null {
	return getTradeReview(trade)?.playbook_id || null;
}

export function getTradeSession(closeTime: string | null | undefined): 'asian' | 'london' | 'newyork' {
	if (!closeTime) return 'newyork';
	const hour = new Date(closeTime).getUTCHours();
	if (hour >= 0 && hour < 8) return 'asian';
	if (hour >= 8 && hour < 15) return 'london';
	return 'newyork';
}

export function getTradeDurationMinutes(openTime: string | null | undefined, closeTime: string | null | undefined): number {
	if (!openTime || !closeTime) return 0;
	return Math.max(0, Math.floor((new Date(closeTime).getTime() - new Date(openTime).getTime()) / 60000));
}

export function getTradeDurationBucket(openTime: string | null | undefined, closeTime: string | null | undefined): PortfolioFilterState['durationBucket'] {
	const minutes = getTradeDurationMinutes(openTime, closeTime);
	if (minutes < 15) return 'scalp';
	if (minutes < 24 * 60) return 'intraday';
	if (minutes < 3 * 24 * 60) return 'swing';
	return 'position';
}

export function applyPortfolioFilters<T extends Trade>(
	trades: T[],
	filters: PortfolioFilterState
) {
	const query = filters.q.trim().toLowerCase();

	return trades.filter((trade) => {
		if (filters.symbols.length > 0 && !filters.symbols.includes(trade.symbol || '')) return false;
		if (filters.directions.length > 0 && !filters.directions.includes(trade.type || '')) return false;
		if (filters.sessions.length > 0 && !filters.sessions.includes(getTradeSession(trade.close_time))) return false;
		if (filters.reviewStatus.length > 0 && !filters.reviewStatus.includes(getTradeReviewStatus(trade))) return false;
		if (filters.playbookIds.length > 0) {
			const playbookId = getTradePlaybookId(trade);
			if (!playbookId || !filters.playbookIds.includes(playbookId)) return false;
		}
		if (filters.tagIds.length > 0) {
			const assignedTagIds = new Set((trade.trade_tag_assignments || []).map((assignment) => assignment.tag_id));
			if (!filters.tagIds.some((tagId) => assignedTagIds.has(tagId))) return false;
		}
		if (filters.outcome === 'win' && Number(trade.profit || 0) <= 0) return false;
		if (filters.outcome === 'loss' && Number(trade.profit || 0) >= 0) return false;
		if (filters.outcome === 'breakeven' && Math.abs(Number(trade.profit || 0)) > 0.01) return false;
		if (filters.hasNotes === true && getTradeNotes(trade).length === 0) return false;
		if (filters.hasNotes === false && getTradeNotes(trade).length > 0) return false;
		if (filters.hasAttachments === true && getTradeAttachments(trade).length === 0) return false;
		if (filters.hasAttachments === false && getTradeAttachments(trade).length > 0) return false;
		if (filters.durationBucket && getTradeDurationBucket(trade.open_time, trade.close_time) !== filters.durationBucket) {
			return false;
		}
		// Numeric range filters
		const profit = Number(trade.profit || 0);
		if (filters.profitMin != null && profit < filters.profitMin) return false;
		if (filters.profitMax != null && profit > filters.profitMax) return false;
		if (filters.lotSizeMin != null && Number(trade.lot_size || 0) < filters.lotSizeMin) return false;
		if (filters.lotSizeMax != null && Number(trade.lot_size || 0) > filters.lotSizeMax) return false;
		if (filters.pipsMin != null && (trade.pips == null || Number(trade.pips) < filters.pipsMin)) return false;
		if (filters.pipsMax != null && (trade.pips == null || Number(trade.pips) > filters.pipsMax)) return false;
		// Review score filters
		const review = getTradeReview(trade);
		if (filters.qualityScoreMin != null && (!review?.setup_quality_score || review.setup_quality_score < filters.qualityScoreMin)) return false;
		if (filters.qualityScoreMax != null && (!review?.setup_quality_score || review.setup_quality_score > filters.qualityScoreMax)) return false;
		if (filters.disciplineScoreMin != null && (!review?.discipline_score || review.discipline_score < filters.disciplineScoreMin)) return false;
		if (filters.disciplineScoreMax != null && (!review?.discipline_score || review.discipline_score > filters.disciplineScoreMax)) return false;
		if (filters.executionScoreMin != null && (!review?.execution_score || review.execution_score < filters.executionScoreMin)) return false;
		if (filters.executionScoreMax != null && (!review?.execution_score || review.execution_score > filters.executionScoreMax)) return false;
		if (filters.confidenceMin != null && (!review?.confidence_at_entry || review.confidence_at_entry < filters.confidenceMin)) return false;
		if (filters.confidenceMax != null && (!review?.confidence_at_entry || review.confidence_at_entry > filters.confidenceMax)) return false;
		// Boolean/enum filters
		if (filters.followedPlan === 'yes' && review?.followed_plan !== true) return false;
		if (filters.followedPlan === 'no' && review?.followed_plan !== false) return false;
		if (filters.hasBrokenRules === 'yes' && (!review?.broken_rules || review.broken_rules.length === 0)) return false;
		if (filters.hasBrokenRules === 'no' && review?.broken_rules && review.broken_rules.length > 0) return false;
		// Day of week filter
		if (filters.dayOfWeek.length > 0) {
			const closeDay = trade.close_time ? new Date(trade.close_time).getDay() : -1;
			if (!filters.dayOfWeek.includes(closeDay)) return false;
		}
		if (filters.from) {
			const closeTime = trade.close_time ? new Date(trade.close_time).getTime() : 0;
			const from = new Date(`${filters.from}T00:00:00Z`).getTime() - THAILAND_OFFSET_MS;
			if (closeTime < from) return false;
		}
		if (filters.to) {
			const closeTime = trade.close_time ? new Date(trade.close_time).getTime() : 0;
			const to = new Date(`${filters.to}T23:59:59Z`).getTime() - THAILAND_OFFSET_MS;
			if (closeTime > to) return false;
		}
		if (query) {
			const haystacks = [
				trade.symbol,
				trade.type,
				getTradeReview(trade)?.entry_reason,
				getTradeReview(trade)?.mistake_summary,
				getTradeReview(trade)?.lesson_summary,
				getTradeNotes(trade)[0]?.content,
				...(trade.trade_tag_assignments || []).map((assignment) => assignment.trade_tags?.name)
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();

			if (!haystacks.includes(query)) return false;
		}

		return true;
	});
}

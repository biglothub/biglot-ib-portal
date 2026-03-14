import type { PortfolioFilterState, ReviewStatus, Trade } from '$lib/types';

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
	durationBucket: ''
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

export function parsePortfolioFilters(searchParams: URLSearchParams): PortfolioFilterState {
	const parseBool = (value: string | null) => {
		if (value == null || value === '') return null;
		return value === '1' || value === 'true';
	};

	const outcome = searchParams.get('outcome');
	const durationBucket = searchParams.get('duration');

	return {
		q: searchParams.get('q') || '',
		from: searchParams.get('from') || '',
		to: searchParams.get('to') || '',
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
				: ''
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
	return params;
}

export function getTradeReview(trade: Partial<Trade> & Record<string, any>) {
	return trade.trade_reviews?.[0] || null;
}

export function getTradeReviewStatus(trade: Partial<Trade> & Record<string, any>): ReviewStatus {
	return getTradeReview(trade)?.review_status || 'unreviewed';
}

export function getTradeNotes(trade: Partial<Trade> & Record<string, any>) {
	return trade.trade_notes || [];
}

export function getTradeAttachments(trade: Partial<Trade> & Record<string, any>) {
	return trade.trade_attachments || [];
}

export function getTradePlaybookId(trade: Partial<Trade> & Record<string, any>): string | null {
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

export function applyPortfolioFilters<T extends Partial<Trade> & Record<string, any>>(
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
			const assignedTagIds = new Set((trade.trade_tag_assignments || []).map((assignment: any) => assignment.tag_id));
			if (!filters.tagIds.every((tagId) => assignedTagIds.has(tagId))) return false;
		}
		if (filters.outcome === 'win' && Number(trade.profit || 0) <= 0) return false;
		if (filters.outcome === 'loss' && Number(trade.profit || 0) >= 0) return false;
		if (filters.outcome === 'breakeven' && Number(trade.profit || 0) !== 0) return false;
		if (filters.hasNotes === true && getTradeNotes(trade).length === 0) return false;
		if (filters.hasNotes === false && getTradeNotes(trade).length > 0) return false;
		if (filters.hasAttachments === true && getTradeAttachments(trade).length === 0) return false;
		if (filters.hasAttachments === false && getTradeAttachments(trade).length > 0) return false;
		if (filters.durationBucket && getTradeDurationBucket(trade.open_time, trade.close_time) !== filters.durationBucket) {
			return false;
		}
		if (filters.from) {
			const closeTime = trade.close_time ? new Date(trade.close_time).getTime() : 0;
			const from = new Date(`${filters.from}T00:00:00`).getTime();
			if (closeTime < from) return false;
		}
		if (filters.to) {
			const closeTime = trade.close_time ? new Date(trade.close_time).getTime() : 0;
			const to = new Date(`${filters.to}T23:59:59`).getTime();
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
				...(trade.trade_tag_assignments || []).map((assignment: any) => assignment.trade_tags?.name)
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();

			if (!haystacks.includes(query)) return false;
		}

		return true;
	});
}

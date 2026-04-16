import { buildSetupPerformance } from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();
	const { account, tags = [] } = parentData;
	const baseData = locals.portfolioBaseData;
	const profile = locals.profile;

	if (!account || !profile || !baseData) {
		return { playbooks: [], setupPerformance: [], tags: [], trades: [] };
	}

	return {
		playbooks: baseData.playbooks,
		setupPerformance: buildSetupPerformance(baseData.trades),
		tags,
		userId: profile.id,
		trades: baseData.trades.slice(0, 100).map(t => {
			// PostgREST returns trade_reviews as a single object (one-to-one via UNIQUE on trade_id)
			// or as an array depending on the query. Normalize before mapping or playbook usage counts to 0.
			const tr = t.trade_reviews;
			const reviews = !tr ? [] : Array.isArray(tr) ? tr : [tr];
			return {
				id: t.id, symbol: t.symbol, type: t.type, profit: t.profit,
				open_time: t.open_time, close_time: t.close_time, lot_size: t.lot_size,
				trade_reviews: reviews.map((r: any) => ({ playbook_id: r.playbook_id }))
			};
		})
	};
};

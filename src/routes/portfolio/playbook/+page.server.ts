import { fetchPortfolioBaseData, buildSetupPerformance } from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();
	const { account, tags = [] } = parentData;
	const profile = locals.profile;

	if (!account || !profile) {
		return { playbooks: [], setupPerformance: [], tags: [], trades: [] };
	}

	const baseData = await fetchPortfolioBaseData(locals.supabase, account.id, profile.id);

	return {
		playbooks: baseData.playbooks,
		setupPerformance: buildSetupPerformance(baseData.trades),
		tags,
		trades: baseData.trades.slice(0, 50)
	};
};

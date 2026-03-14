import { buildSetupPerformance } from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();
	const { account, baseData, tags = [] } = parentData;
	const profile = locals.profile;

	if (!account || !profile || !baseData) {
		return { playbooks: [], setupPerformance: [], tags: [], trades: [] };
	}

	return {
		playbooks: baseData.playbooks,
		setupPerformance: buildSetupPerformance(baseData.trades),
		tags,
		trades: baseData.trades.slice(0, 50)
	};
};

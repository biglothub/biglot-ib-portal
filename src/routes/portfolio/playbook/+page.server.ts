import { buildSetupPerformance } from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();
	const { account, tags = [] } = parentData;
	const baseData = locals.portfolioBaseData;
	const profile = locals.profile;

	if (!account || !profile || !baseData) {
		return { playbooks: [], setupPerformance: [], tags: [], trades: [], templates: [], clonedTemplateIds: [] };
	}

	// Load templates and clones in parallel with setup performance
	const [templatesResult, clonesResult] = await Promise.all([
		locals.supabase
			.from('playbook_templates')
			.select('*')
			.eq('is_published', true)
			.order('clone_count', { ascending: false })
			.limit(50),
		locals.supabase
			.from('playbook_template_clones')
			.select('template_id')
			.eq('user_id', profile.id)
	]);

	const templates = templatesResult.data || [];
	const clonedTemplateIds = (clonesResult.data || []).map((c: { template_id: string }) => c.template_id);

	return {
		playbooks: baseData.playbooks,
		setupPerformance: buildSetupPerformance(baseData.trades),
		tags,
		userId: profile.id,
		trades: baseData.trades.slice(0, 100).map(t => ({
			id: t.id, symbol: t.symbol, type: t.type, profit: t.profit,
			open_time: t.open_time, close_time: t.close_time, lot_size: t.lot_size,
			trade_reviews: (Array.isArray(t.trade_reviews) ? t.trade_reviews : []).map((r: any) => ({ playbook_id: r.playbook_id }))
		})),
		templates,
		clonedTemplateIds
	};
};

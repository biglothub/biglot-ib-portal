import { buildSetupPerformance } from '$lib/server/portfolio';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const parentData = await parent();
	const { account, baseData, tags = [] } = parentData;
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
		trades: baseData.trades.slice(0, 50),
		templates,
		clonedTemplateIds
	};
};

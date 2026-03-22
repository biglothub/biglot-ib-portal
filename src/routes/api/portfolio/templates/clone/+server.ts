import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** POST — Clone a community template into user's playbooks */
export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:templates:clone:${profile.id}`, 10, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	const { template_id } = await request.json();
	if (!template_id) {
		return json({ message: 'template_id is required' }, { status: 400 });
	}

	// Check if already cloned
	const { data: existingClone } = await locals.supabase
		.from('playbook_template_clones')
		.select('id')
		.eq('template_id', template_id)
		.eq('user_id', profile.id)
		.maybeSingle();

	if (existingClone) {
		return json({ message: 'คุณ Clone template นี้แล้ว' }, { status: 409 });
	}

	// Fetch the template
	const { data: template, error: tErr } = await locals.supabase
		.from('playbook_templates')
		.select('*')
		.eq('id', template_id)
		.eq('is_published', true)
		.single();

	if (tErr || !template) {
		return json({ message: 'Template not found' }, { status: 404 });
	}

	// Create a new playbook from template
	const { data: playbook, error: pbErr } = await locals.supabase
		.from('playbooks')
		.insert({
			user_id: profile.id,
			client_account_id: account.id,
			name: `${template.name} (Template)`,
			description: template.description || '',
			entry_criteria: template.entry_criteria || [],
			exit_criteria: template.exit_criteria || [],
			risk_rules: template.risk_rules || [],
			mistakes_to_avoid: template.mistakes_to_avoid || [],
			is_active: true,
			sort_order: 0
		})
		.select()
		.single();

	if (pbErr || !playbook) {
		return json({ message: pbErr?.message || 'Failed to create playbook' }, { status: 500 });
	}

	// Record the clone
	await locals.supabase
		.from('playbook_template_clones')
		.insert({
			template_id: template_id,
			user_id: profile.id,
			playbook_id: playbook.id
		});

	// Increment clone count on template
	await locals.supabase
		.from('playbook_templates')
		.update({ clone_count: (template.clone_count || 0) + 1 })
		.eq('id', template_id);

	return json({ success: true, playbook });
};

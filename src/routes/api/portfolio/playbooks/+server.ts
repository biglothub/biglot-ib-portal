import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ playbooks: [] });
	}

	const { data, error } = await locals.supabase
		.from('playbooks')
		.select('*, trade_tags(id, name, color, category)')
		.eq('client_account_id', account.id)
		.eq('user_id', profile.id)
		.order('sort_order', { ascending: true })
		.order('created_at', { ascending: true });

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ playbooks: data || [] });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:playbooks:${profile.id}`, 20, 60_000)) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	const {
		id,
		name,
		description,
		setup_tag_id,
		entry_criteria,
		exit_criteria,
		risk_rules,
		mistakes_to_avoid,
		example_trade_ids,
		is_active,
		sort_order
	} = await request.json();

	if (!name?.trim()) {
		return json({ message: 'Name is required' }, { status: 400 });
	}

	const payload = {
		id: id || undefined,
		user_id: profile.id,
		client_account_id: account.id,
		name: name.trim(),
		description: description || '',
		setup_tag_id: setup_tag_id || null,
		entry_criteria: Array.isArray(entry_criteria) ? entry_criteria.filter(Boolean) : [],
		exit_criteria: Array.isArray(exit_criteria) ? exit_criteria.filter(Boolean) : [],
		risk_rules: Array.isArray(risk_rules) ? risk_rules.filter(Boolean) : [],
		mistakes_to_avoid: Array.isArray(mistakes_to_avoid) ? mistakes_to_avoid.filter(Boolean) : [],
		example_trade_ids: Array.isArray(example_trade_ids) ? example_trade_ids.filter(Boolean) : [],
		is_active: is_active !== false,
		sort_order: Number.isFinite(sort_order) ? sort_order : 0,
		updated_at: new Date().toISOString()
	};

	const query = id
		? locals.supabase
				.from('playbooks')
				.update(payload)
				.eq('id', id)
				.eq('user_id', profile.id)
				.select('*, trade_tags(id, name, color, category)')
				.single()
		: locals.supabase
				.from('playbooks')
				.insert(payload)
				.select('*, trade_tags(id, name, color, category)')
				.single();

	const { data, error } = await query;
	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true, playbook: data });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:playbooks:delete:${profile.id}`, 20, 60_000)) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const { id } = await request.json();
	if (!id) {
		return json({ message: 'Playbook id is required' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('playbooks')
		.delete()
		.eq('id', id)
		.eq('user_id', profile.id);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};

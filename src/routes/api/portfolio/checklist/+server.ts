import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { getDefaultRules } from '$lib/server/checklist';
import { rateLimit } from '$lib/server/rate-limit';
import { getBangkokToday } from '$lib/utils';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** GET: Fetch checklist rules + today's completions */
export const GET: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ rules: [], completions: [] });
	}

	const [rulesRes, completionsRes] = await Promise.all([
		locals.supabase
			.from('checklist_rules')
			.select('*')
			.eq('client_account_id', account.id)
			.eq('user_id', profile.id)
			.eq('is_active', true)
			.order('sort_order', { ascending: true }),
		locals.supabase
			.from('checklist_completions')
			.select('*')
			.eq('client_account_id', account.id)
			.eq('user_id', profile.id)
			.order('date', { ascending: false })
			.limit(500) // ~60 days × ~8 rules
	]);

	let rules = rulesRes.data || [];

	// Auto-create default rules if none exist
	if (rules.length === 0) {
		const defaults = getDefaultRules();
		const inserts = defaults.map((r, i) => ({
			client_account_id: account.id,
			user_id: profile.id,
			name: r.name,
			type: r.type,
			automated_check: r.automated_check || null,
			condition: r.condition || {},
			sort_order: i,
			is_active: true
		}));

		const { data: created } = await locals.supabase
			.from('checklist_rules')
			.insert(inserts)
			.select();

		rules = created || [];
	}

	return json({
		rules,
		completions: completionsRes.data || []
	});
};

/** POST: Toggle a manual rule completion or save "Start my day" */
export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:checklist:${profile.id}`, 30, 60_000)) {
		return json({ message: 'คำขอมากเกินไป' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'ไม่พบบัญชีที่อนุมัติ' }, { status: 404 });
	}

	const body = await request.json();

	// Handle "start my day"
	if (body.action === 'start_day') {
		const today = getBangkokToday();
		const { error } = await locals.supabase
			.from('daily_starts')
			.upsert({
				client_account_id: account.id,
				user_id: profile.id,
				date: today,
				started_at: new Date().toISOString()
			}, { onConflict: 'client_account_id,date' });

		if (error) return json({ message: error.message }, { status: 500 });
		return json({ success: true });
	}

	// Handle toggle completion
	if (body.action === 'toggle') {
		const { rule_id, date, completed } = body;
		if (!rule_id || !date) {
			return json({ message: 'ต้องระบุ rule_id และ date' }, { status: 400 });
		}

		const { error } = await locals.supabase
			.from('checklist_completions')
			.upsert({
				client_account_id: account.id,
				user_id: profile.id,
				rule_id,
				date,
				completed: !!completed,
				auto_value: body.auto_value ?? null,
				completed_at: completed ? new Date().toISOString() : null
			}, { onConflict: 'rule_id,date' });

		if (error) return json({ message: error.message }, { status: 500 });
		return json({ success: true });
	}

	// Handle add rule
	if (body.action === 'add_rule') {
		const { data, error } = await locals.supabase
			.from('checklist_rules')
			.insert({
				client_account_id: account.id,
				user_id: profile.id,
				name: body.name,
				type: body.type || 'manual',
				automated_check: body.automated_check || null,
				condition: body.condition || {},
				sort_order: body.sort_order ?? 99,
				is_active: true
			})
			.select()
			.single();

		if (error) return json({ message: error.message }, { status: 500 });
		return json({ success: true, rule: data });
	}

	// Handle delete rule
	if (body.action === 'delete_rule') {
		const { error } = await locals.supabase
			.from('checklist_rules')
			.update({ is_active: false })
			.eq('id', body.rule_id)
			.eq('user_id', profile.id);

		if (error) return json({ message: error.message }, { status: 500 });
		return json({ success: true });
	}

	return json({ message: 'การกระทำไม่ถูกต้อง' }, { status: 400 });
};

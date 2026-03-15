import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import {
	buildProgressSnapshot,
	fetchPortfolioBaseData
} from '$lib/server/portfolio';
import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ goals: [], snapshot: [] });
	}

	const { trades, dailyStats, journals, progressGoals } = await fetchPortfolioBaseData(
		locals.supabase,
		account.id,
		profile.id
	);

	return json({
		goals: progressGoals,
		snapshot: buildProgressSnapshot(trades, journals, dailyStats, progressGoals)
	});
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:progress:${profile.id}`, 20, 60_000)) {
		return json({ message: 'Too many requests' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	const { goal_type, target_value, period_days, is_active } = await request.json();
	const validGoalTypes = ['review_completion', 'journal_streak', 'max_rule_breaks', 'profit_factor', 'win_rate'];

	if (!validGoalTypes.includes(goal_type)) {
		return json({ message: 'Invalid goal_type' }, { status: 400 });
	}

	const payload = {
		user_id: profile.id,
		client_account_id: account.id,
		goal_type,
		target_value: Number(target_value || 0),
		period_days: Number(period_days || 30),
		is_active: is_active !== false,
		updated_at: new Date().toISOString()
	};

	const { data, error } = await locals.supabase
		.from('progress_goals')
		.upsert(payload, { onConflict: 'user_id,client_account_id,goal_type' })
		.select()
		.single();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true, goal: data });
};

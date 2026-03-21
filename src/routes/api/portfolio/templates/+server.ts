import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** GET — Browse published templates + own templates */
export const GET: RequestHandler = async ({ url, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	const category = url.searchParams.get('category') || '';
	const search = url.searchParams.get('q') || '';
	const sort = url.searchParams.get('sort') || 'popular'; // popular | newest | win_rate
	const mine = url.searchParams.get('mine') === '1';

	let query = locals.supabase
		.from('playbook_templates')
		.select('*')
		.eq('is_published', true);

	if (mine) {
		query = locals.supabase
			.from('playbook_templates')
			.select('*')
			.eq('author_id', profile.id);
	}

	if (category && category !== 'all') {
		query = query.eq('category', category);
	}

	if (search.trim()) {
		query = query.or(`name.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`);
	}

	switch (sort) {
		case 'newest':
			query = query.order('created_at', { ascending: false });
			break;
		case 'win_rate':
			query = query.order('win_rate', { ascending: false });
			break;
		default: // popular
			query = query.order('clone_count', { ascending: false });
			break;
	}

	query = query.limit(50);

	const { data, error } = await query;
	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	// Also fetch user's cloned template IDs
	const { data: clones } = await locals.supabase
		.from('playbook_template_clones')
		.select('template_id')
		.eq('user_id', profile.id);

	const clonedIds = new Set((clones || []).map((c: { template_id: string }) => c.template_id));

	const templates = (data || []).map((t: Record<string, unknown>) => ({
		...t,
		is_cloned: clonedIds.has(t.id as string),
		is_own: t.author_id === profile.id
	}));

	return json({ templates });
};

/** POST — Publish a playbook as a community template */
export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:templates:publish:${profile.id}`, 10, 60_000)) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	const { playbook_id, category } = await request.json();

	if (!playbook_id) {
		return json({ message: 'playbook_id is required' }, { status: 400 });
	}

	// Fetch the source playbook (owned by user)
	const { data: playbook, error: pbErr } = await locals.supabase
		.from('playbooks')
		.select('*')
		.eq('id', playbook_id)
		.eq('user_id', profile.id)
		.single();

	if (pbErr || !playbook) {
		return json({ message: 'Playbook not found' }, { status: 404 });
	}

	// Check if already published from this playbook
	const { data: existing } = await locals.supabase
		.from('playbook_templates')
		.select('id')
		.eq('source_playbook_id', playbook_id)
		.eq('author_id', profile.id)
		.maybeSingle();

	if (existing) {
		return json({ message: 'Playbook นี้ถูกเผยแพร่แล้ว' }, { status: 409 });
	}

	// Compute performance stats from trades tagged with this playbook's setup
	let totalTrades = 0;
	let winRate = 0;
	let avgRr = 0;
	let netPnl = 0;

	if (playbook.setup_tag_id) {
		const { data: reviews } = await locals.supabase
			.from('trade_reviews')
			.select('trade_id, trades!inner(profit, type)')
			.eq('playbook_id', playbook.id)
			.eq('user_id', profile.id);

		if (reviews && reviews.length > 0) {
			totalTrades = reviews.length;
			let wins = 0;
			let totalProfit = 0;

			for (const r of reviews) {
				const trade = r.trades as unknown as { profit: number; type: string };
				if (trade) {
					totalProfit += trade.profit || 0;
					if ((trade.profit || 0) > 0) wins++;
				}
			}
			netPnl = totalProfit;
			winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
		}
	}

	const authorName = profile.full_name || 'Anonymous';

	const { data: template, error: insertErr } = await locals.supabase
		.from('playbook_templates')
		.insert({
			author_id: profile.id,
			author_name: authorName,
			source_playbook_id: playbook.id,
			name: playbook.name,
			description: playbook.description || '',
			category: category || 'general',
			entry_criteria: playbook.entry_criteria || [],
			exit_criteria: playbook.exit_criteria || [],
			risk_rules: playbook.risk_rules || [],
			mistakes_to_avoid: playbook.mistakes_to_avoid || [],
			total_trades: totalTrades,
			win_rate: Math.round(winRate * 100) / 100,
			avg_rr: avgRr,
			net_pnl: Math.round(netPnl * 100) / 100
		})
		.select()
		.single();

	if (insertErr) {
		return json({ message: insertErr.message }, { status: 500 });
	}

	return json({ success: true, template });
};

/** DELETE — Unpublish own template */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:templates:delete:${profile.id}`, 10, 60_000)) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const { id } = await request.json();
	if (!id) {
		return json({ message: 'Template id is required' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('playbook_templates')
		.delete()
		.eq('id', id)
		.eq('author_id', profile.id);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};

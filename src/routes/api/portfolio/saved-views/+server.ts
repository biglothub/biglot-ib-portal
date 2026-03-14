import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ views: [] });
	}

	const page = url.searchParams.get('page');
	let query = locals.supabase
		.from('portfolio_saved_views')
		.select('*')
		.eq('client_account_id', account.id)
		.eq('user_id', profile.id)
		.order('name', { ascending: true });

	if (page === 'trades' || page === 'analytics') {
		query = query.eq('page', page);
	}

	const { data, error } = await query;
	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ views: data || [] });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	const { id, page, name, filters } = await request.json();
	if ((page !== 'trades' && page !== 'analytics') || !name?.trim()) {
		return json({ message: 'Invalid saved view payload' }, { status: 400 });
	}

	const payload = {
		id: id || undefined,
		user_id: profile.id,
		client_account_id: account.id,
		page,
		name: name.trim(),
		filters: filters || {},
		updated_at: new Date().toISOString()
	};

	const query = id
		? locals.supabase
				.from('portfolio_saved_views')
				.update(payload)
				.eq('id', id)
				.eq('user_id', profile.id)
				.select()
				.single()
		: locals.supabase.from('portfolio_saved_views').insert(payload).select().single();

	const { data, error } = await query;
	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true, view: data });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const { id } = await request.json();
	if (!id) {
		return json({ message: 'Missing saved view id' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('portfolio_saved_views')
		.delete()
		.eq('id', id)
		.eq('user_id', profile.id);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};

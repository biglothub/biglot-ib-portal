import { json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limit';
import { isSafeUrl } from '$lib/server/trade-guard';
import { sendPushToUser, type PushCategory } from '$lib/server/push';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'admin') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`push:send:${profile.id}`, 10, 60_000))) {
		return json({ message: 'Rate limit exceeded' }, { status: 429 });
	}

	const { userId, title, body, url, category, tag, data } = await request.json();

	if (!userId || !title) {
		return json({ message: 'Missing required fields' }, { status: 400 });
	}

	const safeUrl = (url && isSafeUrl(url)) ? url : '/';
	await sendPushToUser(locals.supabase, userId, {
		category: (category || 'general') as PushCategory,
		title,
		body: body || '',
		url: safeUrl,
		tag,
		data
	});

	return json({ success: true });
};

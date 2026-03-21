import { json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

/** POST /api/portfolio/social/[id]/like — toggle like on a post */
export const POST: RequestHandler = async ({ params, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	if (!rateLimit(`social:like:${profile.id}`, 30, 60_000)) {
		return json({ message: 'Rate limit exceeded' }, { status: 429 });
	}

	const postId = params.id;

	// Check if already liked
	const { data: existing } = await locals.supabase
		.from('social_likes')
		.select('post_id')
		.eq('post_id', postId)
		.eq('user_id', profile.id)
		.maybeSingle();

	if (existing) {
		// Unlike
		const { error } = await locals.supabase
			.from('social_likes')
			.delete()
			.eq('post_id', postId)
			.eq('user_id', profile.id);

		if (error) {
			return json({ message: error.message }, { status: 500 });
		}

		return json({ liked: false });
	} else {
		// Like
		const { error } = await locals.supabase
			.from('social_likes')
			.insert({ post_id: postId, user_id: profile.id });

		if (error) {
			return json({ message: error.message }, { status: 500 });
		}

		return json({ liked: true });
	}
};

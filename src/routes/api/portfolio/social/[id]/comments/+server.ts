import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface SocialComment {
	id: string;
	post_id: string;
	user_id: string;
	display_name: string;
	avatar_url: string | null;
	content: string;
	created_at: string;
}

/** GET /api/portfolio/social/[id]/comments — list comments for a post */
export const GET: RequestHandler = async ({ params, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const { data: comments, error } = await locals.supabase
		.from('social_comments')
		.select('id, post_id, user_id, display_name, avatar_url, content, created_at')
		.eq('post_id', params.id)
		.order('created_at', { ascending: true });

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ comments: (comments ?? []) as SocialComment[] });
};

/** POST /api/portfolio/social/[id]/comments — add a comment */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const body = await request.json() as { content: string };
	const { content } = body;

	if (!content || content.trim().length === 0) {
		return json({ message: 'กรุณาระบุเนื้อหา' }, { status: 400 });
	}

	if (content.length > 300) {
		return json({ message: 'ความคิดเห็นต้องไม่เกิน 300 ตัวอักษร' }, { status: 400 });
	}

	// Resolve display name from social_settings or profile
	const { data: settings } = await locals.supabase
		.from('social_settings')
		.select('display_name')
		.eq('user_id', profile.id)
		.maybeSingle();

	const displayName =
		(settings?.display_name && settings.display_name !== '')
			? settings.display_name
			: (profile.full_name || profile.email);

	const { data: comment, error } = await locals.supabase
		.from('social_comments')
		.insert({
			post_id: params.id,
			user_id: profile.id,
			display_name: displayName,
			avatar_url: profile.avatar_url ?? null,
			content: content.trim()
		})
		.select('id, post_id, user_id, display_name, avatar_url, content, created_at')
		.single();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ comment: comment as SocialComment }, { status: 201 });
};

/** DELETE /api/portfolio/social/[id]/comments?comment_id=<uuid> — delete own comment */
export const DELETE: RequestHandler = async ({ params, url, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const commentId = url.searchParams.get('comment_id');
	if (!commentId) {
		return json({ message: 'Missing comment_id' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('social_comments')
		.delete()
		.eq('id', commentId)
		.eq('post_id', params.id)
		.eq('user_id', profile.id);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};

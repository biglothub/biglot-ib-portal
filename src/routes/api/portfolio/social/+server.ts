import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface SocialPost {
	id: string;
	user_id: string;
	display_name: string;
	avatar_url: string | null;
	post_type: 'trade_share' | 'insight' | 'milestone';
	content: string;
	trade_id: string | null;
	trade_symbol: string | null;
	trade_side: string | null;
	trade_profit: number | null;
	likes_count: number;
	comments_count: number;
	created_at: string;
	liked_by_me: boolean;
}

const POST_TYPES = ['trade_share', 'insight', 'milestone'] as const;

/** GET /api/portfolio/social?cursor=<iso>&limit=20 — paginated feed */
export const GET: RequestHandler = async ({ locals, url }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const cursor = url.searchParams.get('cursor');
	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50);

	let query = locals.supabase
		.from('social_posts')
		.select('id, user_id, display_name, avatar_url, post_type, content, trade_id, trade_symbol, trade_side, trade_profit, likes_count, comments_count, created_at')
		.order('created_at', { ascending: false })
		.limit(limit);

	if (cursor) {
		query = query.lt('created_at', cursor);
	}

	const { data: posts, error } = await query;

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	if (!posts || posts.length === 0) {
		return json({ posts: [] });
	}

	// Fetch which posts the current user has liked
	const postIds = posts.map((p) => p.id);
	const { data: likes } = await locals.supabase
		.from('social_likes')
		.select('post_id')
		.eq('user_id', profile.id)
		.in('post_id', postIds);

	const likedSet = new Set((likes ?? []).map((l: { post_id: string }) => l.post_id));

	const result: SocialPost[] = posts.map((p) => ({
		...p,
		trade_profit: p.trade_profit !== null ? Number(p.trade_profit) : null,
		liked_by_me: likedSet.has(p.id)
	}));

	return json({ posts: result });
};

/** POST /api/portfolio/social — create a new post */
export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	// Must have opted-in (social_settings with is_public=true)
	const { data: settings } = await locals.supabase
		.from('social_settings')
		.select('display_name, is_public')
		.eq('user_id', profile.id)
		.maybeSingle();

	if (!settings?.is_public) {
		return json({ message: 'กรุณาเปิดใช้งานโปรไฟล์สังคมก่อน' }, { status: 403 });
	}

	const body = await request.json() as {
		post_type: string;
		content: string;
		trade_id?: string;
		trade_symbol?: string;
		trade_side?: string;
		trade_profit?: number;
	};

	const { post_type, content, trade_id, trade_symbol, trade_side, trade_profit } = body;

	if (!POST_TYPES.includes(post_type as typeof POST_TYPES[number])) {
		return json({ message: 'ประเภทโพสต์ไม่ถูกต้อง' }, { status: 400 });
	}

	if (!content || content.trim().length === 0) {
		return json({ message: 'กรุณาระบุเนื้อหา' }, { status: 400 });
	}

	if (content.length > 500) {
		return json({ message: 'เนื้อหาต้องไม่เกิน 500 ตัวอักษร' }, { status: 400 });
	}

	const { data: post, error } = await locals.supabase
		.from('social_posts')
		.insert({
			user_id: profile.id,
			display_name: settings.display_name || profile.full_name || profile.email,
			avatar_url: profile.avatar_url ?? null,
			post_type,
			content: content.trim(),
			trade_id: trade_id ?? null,
			trade_symbol: trade_symbol ?? null,
			trade_side: trade_side ?? null,
			trade_profit: trade_profit ?? null
		})
		.select('id, user_id, display_name, avatar_url, post_type, content, trade_id, trade_symbol, trade_side, trade_profit, likes_count, comments_count, created_at')
		.single();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ post: { ...post, liked_by_me: false } }, { status: 201 });
};

/** DELETE /api/portfolio/social?id=<uuid> — delete own post */
export const DELETE: RequestHandler = async ({ url, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const id = url.searchParams.get('id');
	if (!id) {
		return json({ message: 'Missing id' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('social_posts')
		.delete()
		.eq('id', id)
		.eq('user_id', profile.id);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};

import { json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export interface SocialSettings {
	user_id: string;
	display_name: string;
	bio: string;
	is_public: boolean;
	client_account_id: string | null;
}

/** GET /api/portfolio/social/settings — own social settings */
export const GET: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const { data, error } = await locals.supabase
		.from('social_settings')
		.select('user_id, display_name, bio, is_public, client_account_id')
		.eq('user_id', profile.id)
		.maybeSingle();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ settings: data as SocialSettings | null });
};

/** POST /api/portfolio/social/settings — upsert social settings */
export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	if (!(await rateLimit(`social:settings:${profile.id}`, 10, 60_000))) {
		return json({ message: 'Rate limit exceeded' }, { status: 429 });
	}

	const body = await request.json() as {
		display_name: string;
		bio?: string;
		is_public: boolean;
		client_account_id?: string | null;
	};

	const { display_name, bio, is_public, client_account_id } = body;

	if (!display_name || display_name.trim().length === 0) {
		return json({ message: 'กรุณาระบุชื่อแสดง' }, { status: 400 });
	}

	if (display_name.length > 50) {
		return json({ message: 'ชื่อแสดงต้องไม่เกิน 50 ตัวอักษร' }, { status: 400 });
	}

	const { data, error } = await locals.supabase
		.from('social_settings')
		.upsert({
			user_id: profile.id,
			display_name: display_name.trim(),
			bio: (bio ?? '').trim(),
			is_public: !!is_public,
			client_account_id: client_account_id ?? null
		})
		.select('user_id, display_name, bio, is_public, client_account_id')
		.single();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ settings: data as SocialSettings });
};

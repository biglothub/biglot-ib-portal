import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface LeaderboardEntry {
	user_id: string;
	display_name: string;
	avatar_url: string | null;
	bio: string;
	net_pnl: number;
	win_rate: number;
	total_trades: number;
	profit_factor: number;
}

/** GET /api/portfolio/social/leaderboard — top traders who opted in */
export const GET: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const { data, error } = await locals.supabase
		.rpc('get_social_leaderboard');

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	const entries: LeaderboardEntry[] = (data ?? []).map((row: {
		user_id: string;
		display_name: string;
		avatar_url: string | null;
		bio: string;
		net_pnl: number | string;
		win_rate: number | string;
		total_trades: number | string;
		profit_factor: number | string;
	}) => ({
		user_id: row.user_id,
		display_name: row.display_name,
		avatar_url: row.avatar_url,
		bio: row.bio,
		net_pnl: Number(row.net_pnl),
		win_rate: Number(row.win_rate),
		total_trades: Number(row.total_trades),
		profit_factor: Number(row.profit_factor)
	}));

	return json({ leaderboard: entries });
};

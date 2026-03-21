import type { PageServerLoad } from './$types';
import type { SocialPost } from '../../api/portfolio/social/+server';
import type { LeaderboardEntry } from '../../api/portfolio/social/leaderboard/+server';
import type { SocialSettings } from '../../api/portfolio/social/settings/+server';

export const load: PageServerLoad = async ({ locals }) => {
	const profile = locals.profile;

	if (!profile) {
		return {
			initialPosts: [] as SocialPost[],
			leaderboard: [] as LeaderboardEntry[],
			mySettings: null as SocialSettings | null,
			myAccounts: [] as { id: string; mt5_account_id: string; mt5_server: string }[]
		};
	}

	const [postsRes, leaderboardRes, settingsRes, accountsRes] = await Promise.all([
		// Recent 20 posts
		locals.supabase
			.from('social_posts')
			.select('id, user_id, display_name, avatar_url, post_type, content, trade_id, trade_symbol, trade_side, trade_profit, likes_count, comments_count, created_at')
			.order('created_at', { ascending: false })
			.limit(20),

		// Leaderboard (security definer RPC)
		locals.supabase.rpc('get_social_leaderboard'),

		// Own social settings
		locals.supabase
			.from('social_settings')
			.select('user_id, display_name, bio, is_public, client_account_id')
			.eq('user_id', profile.id)
			.maybeSingle(),

		// Own approved accounts (for leaderboard account picker)
		locals.supabase
			.from('client_accounts')
			.select('id, mt5_account_id, mt5_server')
			.eq('status', 'approved')
			.order('created_at', { ascending: true })
	]);

	const rawPosts = postsRes.data ?? [];

	// Fetch which posts the current user has liked
	let likedSet = new Set<string>();
	if (rawPosts.length > 0) {
		const postIds = rawPosts.map((p: { id: string }) => p.id);
		const { data: likes } = await locals.supabase
			.from('social_likes')
			.select('post_id')
			.eq('user_id', profile.id)
			.in('post_id', postIds);

		likedSet = new Set((likes ?? []).map((l: { post_id: string }) => l.post_id));
	}

	const initialPosts: SocialPost[] = rawPosts.map((p: {
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
	}) => ({
		...p,
		trade_profit: p.trade_profit !== null ? Number(p.trade_profit) : null,
		liked_by_me: likedSet.has(p.id)
	}));

	const leaderboard: LeaderboardEntry[] = (leaderboardRes.data ?? []).map((row: {
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

	return {
		initialPosts,
		leaderboard,
		mySettings: (settingsRes.data as SocialSettings | null),
		myAccounts: (accountsRes.data ?? []) as { id: string; mt5_account_id: string; mt5_server: string }[]
	};
};

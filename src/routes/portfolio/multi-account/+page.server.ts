import type { PageServerLoad } from './$types';

interface AccountSummary {
	account: {
		id: string;
		client_name: string;
		mt5_account_id: string;
		mt5_server: string;
		last_synced_at: string | null;
	};
	latestBalance: number;
	latestEquity: number;
	todayPnl: number;
	netPnl: number;
	totalTrades: number;
	tradeWinRate: number;
	profitFactor: number;
	maxDrawdown: number;
	lastDate: string | null;
}

export const load: PageServerLoad = async ({ locals, parent }) => {
	const parentData = await parent();

	// Admin view not supported for multi-account
	if (parentData.isAdminView) {
		return { accounts: [], accountSummaries: [], combined: null };
	}

	const supabase = locals.supabase;
	const userId = parentData.userId;

	if (!userId) {
		return { accounts: [], accountSummaries: [], combined: null };
	}

	// Fetch ALL approved accounts for this user
	const { data: accounts } = await supabase
		.from('client_accounts')
		.select('id, client_name, mt5_account_id, mt5_server, last_synced_at')
		.eq('status', 'approved')
		.order('created_at', { ascending: true });

	if (!accounts || accounts.length === 0) {
		return { accounts: [], accountSummaries: [], combined: null };
	}

	// Load summary data per account in parallel
	const summaries = await Promise.all(
		accounts.map(async (account): Promise<AccountSummary> => {
			const [latestStatsRes, tradesRes] = await Promise.all([
				supabase
					.from('daily_stats')
					.select('date, balance, equity, profit, max_drawdown')
					.eq('client_account_id', account.id)
					.order('date', { ascending: false })
					.limit(1)
					.maybeSingle(),
				supabase
					.from('trades')
					.select('profit')
					.eq('client_account_id', account.id)
			]);

			const latestStats = latestStatsRes.data;
			const trades = tradesRes.data || [];

			const netPnl = trades.reduce((sum, t) => sum + Number(t.profit || 0), 0);
			const wins = trades.filter((t) => Number(t.profit || 0) > 0);
			const losses = trades.filter((t) => Number(t.profit || 0) < 0);
			const tradeWinRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
			const grossWin = wins.reduce((s, t) => s + Number(t.profit || 0), 0);
			const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.profit || 0), 0));
			const profitFactor = grossLoss > 0 ? Math.min(grossWin / grossLoss, 999) : grossWin > 0 ? 999 : 0;

			return {
				account,
				latestBalance: latestStats?.balance ?? 0,
				latestEquity: latestStats?.equity ?? 0,
				todayPnl: latestStats?.profit ?? 0,
				netPnl,
				totalTrades: trades.length,
				tradeWinRate,
				profitFactor,
				maxDrawdown: latestStats?.max_drawdown ?? 0,
				lastDate: latestStats?.date ?? null
			};
		})
	);

	const combinedNetPnl = summaries.reduce((s, a) => s + a.netPnl, 0);
	const combinedBalance = summaries.reduce((s, a) => s + a.latestBalance, 0);
	const combinedEquity = summaries.reduce((s, a) => s + a.latestEquity, 0);
	const combinedTrades = summaries.reduce((s, a) => s + a.totalTrades, 0);
	const combinedTodayPnl = summaries.reduce((s, a) => s + a.todayPnl, 0);

	return {
		accounts,
		accountSummaries: summaries,
		combined: {
			netPnl: combinedNetPnl,
			balance: combinedBalance,
			equity: combinedEquity,
			totalTrades: combinedTrades,
			todayPnl: combinedTodayPnl
		}
	};
};

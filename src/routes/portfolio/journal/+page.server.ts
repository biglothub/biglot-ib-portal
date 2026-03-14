import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const { account } = await parent();
	const supabase = locals.supabase;
	const profile = locals.profile;

	if (!account || !profile) {
		return { journals: [], dailyHistory: [], selectedDate: '' };
	}

	// Get selected month/year from URL or use current
	const now = new Date();
	const year = parseInt(url.searchParams.get('year') || String(now.getFullYear()));
	const month = parseInt(url.searchParams.get('month') || String(now.getMonth() + 1));
	const selectedDate = url.searchParams.get('date') || '';

	// Fetch journal entries for the month
	const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
	const endDate = new Date(year, month, 0); // last day of month
	const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

	const { data: journals } = await supabase
		.from('daily_journal')
		.select('*')
		.eq('user_id', profile.id)
		.eq('client_account_id', account.id)
		.gte('date', startDate)
		.lte('date', endDateStr)
		.order('date', { ascending: true });

	// Fetch trade data for the month (for calendar display)
	const THAILAND_OFFSET_MS = 7 * 60 * 60 * 1000;
	const { data: trades } = await supabase
		.from('trades')
		.select('close_time, profit')
		.eq('client_account_id', account.id)
		.gte('close_time', startDate)
		.lte('close_time', endDateStr + 'T23:59:59')
		.order('close_time', { ascending: true });

	// Build daily history from trades
	const dailyMap = new Map<string, { profit: number; trades: number }>();
	for (const trade of (trades || [])) {
		const closeTime = new Date(trade.close_time);
		const thaiTime = new Date(closeTime.getTime() + THAILAND_OFFSET_MS);
		const dateKey = thaiTime.toISOString().split('T')[0];

		if (!dailyMap.has(dateKey)) {
			dailyMap.set(dateKey, { profit: 0, trades: 0 });
		}
		const day = dailyMap.get(dateKey)!;
		day.profit += trade.profit || 0;
		day.trades += 1;
	}

	const dailyHistory = Array.from(dailyMap.entries()).map(([date, data]) => ({
		date,
		profit: data.profit,
		totalTrades: data.trades
	}));

	// Fetch selected date's journal if a date is selected
	let selectedJournal = null;
	if (selectedDate) {
		selectedJournal = (journals || []).find((j: any) => j.date === selectedDate) || null;
	}

	return {
		journals: journals || [],
		dailyHistory,
		selectedDate,
		selectedJournal,
		year,
		month
	};
};

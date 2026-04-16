import { buildDailyHistory } from '$lib/server/portfolio';
import { evaluateDayInsights } from '$lib/server/insights/engine';
import { toThaiDateString } from '$lib/utils';
import type { DailyJournal, Trade } from '$lib/types';
import type { PageServerLoad } from './$types';

// Bug #2 fix: always compute date strings in UTC+7 (Bangkok) so they align
// with how toThaiDateString() filters trades (which already uses UTC+7).
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
function toBangkokDateStr(date: Date): string {
	return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();
	const { account } = parentData;
	const baseData = locals.portfolioBaseData;

	if (!account || !baseData) {
		return {
			selectedDate: null,
			viewMode: 'day',
			feed: [],
			calendarDays: [],
			weekData: null,
			selectedDayInsights: []
		};
	}

	const trades = baseData.trades || [];
	const journals = baseData.journals || [];
	const viewMode = url.searchParams.get('view') || 'day';
	const dateParam = url.searchParams.get('date');
	const today = new Date().toISOString().split('T')[0];
	const selectedDate = dateParam || today;

	const journalsByDate = new Map<string, DailyJournal>(
		journals.map((journal: DailyJournal) => [journal.date, journal])
	);

	// Build daily history (memoized by trades reference)
	const dailyHistory = buildDailyHistory(trades);

	// Group all trades by Thai date in one pass O(n)
	const tradesByDate = new Map<string, Trade[]>();
	for (const t of trades) {
		const d = toThaiDateString(t.close_time);
		if (!tradesByDate.has(d)) tradesByDate.set(d, []);
		tradesByDate.get(d)!.push(t);
	}

	// Build feed (newest first)
	const feed = [...dailyHistory].reverse().map((day) => {
		const dayTrades = tradesByDate.get(day.date) || [];
		const wins = dayTrades.filter((t) => Number(t.profit || 0) > 0);
		const losses = dayTrades.filter((t) => Number(t.profit || 0) < 0);
		const totalWin = wins.reduce((s, t) => s + Number(t.profit || 0), 0);
		const totalLoss = Math.abs(losses.reduce((s, t) => s + Number(t.profit || 0), 0));
		const journal = journalsByDate.get(day.date);
		const hasJournalEntry = !!journal && (
			(journal.post_market_notes || '').trim().length > 0 ||
			(journal.pre_market_notes || '').trim().length > 0 ||
			(journal.session_plan || '').trim().length > 0 ||
			(journal.market_bias || '').trim().length > 0 ||
			(journal.key_levels || '').trim().length > 0 ||
			(journal.lessons || '').trim().length > 0 ||
			(journal.tomorrow_focus || '').trim().length > 0 ||
			journal.completion_status !== 'not_started'
		);

		// Intraday cumulative P&L series for sparkline
		// Bug #9 fix: was `> 1`, now `>= 1` so single-trade days still get a series
		let cum = 0;
		const intradayCumPnl = dayTrades.length >= 1
			? [...dayTrades]
				.sort((a, b) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime())
				.map((t) => {
					cum += Number(t.profit || 0);
					return { time: Math.floor(new Date(t.close_time).getTime() / 1000), value: cum };
				})
			: [];

		return {
			date: day.date,
			netPnl: day.profit,
			grossPnl: day.profit,
			totalTrades: dayTrades.length,
			winners: wins.length,
			losers: losses.length,
			winRate: dayTrades.length > 0 ? (wins.length / dayTrades.length) * 100 : 0,
			commissions: dayTrades.reduce((s, t) => s + Math.abs(Number(t.commission || 0)), 0),
			volume: dayTrades.reduce((s, t) => s + Number(t.lot_size || 0), 0),
			profitFactor: totalLoss > 0 ? Math.min(totalWin / totalLoss, 999) : totalWin > 0 ? 999 : 0,
			hasJournalEntry,
			intradayCumPnl,
			trades: dayTrades
		};
	});

	// Calendar days with correct shape for MiniCalendar
	const calendarDays = dailyHistory.map((d) => ({
		date: d.date,
		profit: d.profit,
		totalTrades: d.totalTrades
	}));

	// Day insights — only for selected date (avoid running N times)
	const selectedDayTrades = tradesByDate.get(selectedDate) || [];
	const selectedDayInsights = selectedDayTrades.length > 0
		? evaluateDayInsights(selectedDayTrades, trades)
		: [];

	// Week view data
	// Bug #2 fix: build week boundaries in UTC+7 to match toThaiDateString() trade dates.
	// `selectedDate` is already a Bangkok date string (YYYY-MM-DD), so interpret it
	// as midnight Bangkok time to derive the week boundaries consistently.
	const selectedDateObj = new Date(selectedDate + 'T00:00:00+07:00');
	const dayOfWeek = selectedDateObj.getUTCDay(); // day-of-week in UTC+7 via ISO offset
	// Rewind to Sunday of the current Bangkok week
	const weekStartMs = selectedDateObj.getTime() - dayOfWeek * 24 * 60 * 60 * 1000;
	const weekStartBkk = new Date(weekStartMs);
	const weekEndBkk = new Date(weekStartMs + 6 * 24 * 60 * 60 * 1000);
	const weekStartStr = toBangkokDateStr(weekStartBkk);
	const weekEndStr = toBangkokDateStr(weekEndBkk);

	const weekTrades = trades.filter((t: Trade) => {
		const d = toThaiDateString(t.close_time);
		return d >= weekStartStr && d <= weekEndStr;
	});

	const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์'];
	const dayCards = dayNames.map((name, i) => {
		const dayDate = new Date(weekStartMs + i * 24 * 60 * 60 * 1000);
		const dayStr = toBangkokDateStr(dayDate);
		const dayTr = weekTrades.filter((t: Trade) => toThaiDateString(t.close_time) === dayStr);
		const pnl = dayTr.reduce((sum: number, t: Trade) => sum + Number(t.profit || 0), 0);
		return { day: name, date: dayStr, trades: dayTr.length, pnl, hasData: dayTr.length > 0 };
	});

	const weekWins = weekTrades.filter((t: Trade) => Number(t.profit || 0) > 0);
	const weekLosses = weekTrades.filter((t: Trade) => Number(t.profit || 0) < 0);
	const weekPnl = weekTrades.reduce((sum: number, t: Trade) => sum + Number(t.profit || 0), 0);
	const totalWinning = weekWins.reduce((sum: number, t: Trade) => sum + Number(t.profit || 0), 0);
	const totalLosing = Math.abs(weekLosses.reduce((sum: number, t: Trade) => sum + Number(t.profit || 0), 0));

	const weekData = {
		weekStart: weekStartStr,
		weekEnd: weekEndStr,
		dayCards,
		trades: weekTrades,
		stats: {
			totalTrades: weekTrades.length,
			winRate: weekTrades.length > 0 ? (weekWins.length / weekTrades.length) * 100 : 0,
			grossPnl: weekPnl,
			// Bug #1 fix: cap week profit factor at 999, matching day-view behaviour
			profitFactor: totalLosing > 0 ? Math.min(totalWinning / totalLosing, 999) : totalWinning > 0 ? 999 : 0,
			winners: weekWins.length,
			losers: weekLosses.length,
			commissions: weekTrades.reduce((sum: number, t: Trade) => sum + Math.abs(Number(t.commission || 0)), 0)
		}
	};

	return {
		selectedDate,
		viewMode,
		feed,
		calendarDays,
		weekData,
		selectedDayInsights
	};
};

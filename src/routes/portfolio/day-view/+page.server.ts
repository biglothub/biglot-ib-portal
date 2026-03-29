import { buildDailyHistory, buildKpiMetrics } from '$lib/server/portfolio';
import { evaluateDayInsights } from '$lib/server/insights/engine';
import { toThaiDateString } from '$lib/utils';
import type { Trade } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const parentData = await parent();
	const { account } = parentData;
	const baseData = locals.portfolioBaseData;

	if (!account || !baseData) {
		return {
			selectedDate: null,
			viewMode: 'day',
			dayTrades: [],
			daySummary: null,
			weekData: null,
			calendarDays: []
		};
	}

	const trades = baseData.trades || [];
	const viewMode = url.searchParams.get('view') || 'day';
	const dateParam = url.searchParams.get('date');

	// Build daily history for calendar coloring
	const dailyHistory = buildDailyHistory(trades);

	// Determine selected date
	const today = new Date().toISOString().split('T')[0];
	const selectedDate = dateParam || today;

	// Day View: filter trades by selected date
	const dayTrades = trades.filter((t: Trade) => {
		const tradeDate = toThaiDateString(t.close_time);
		return tradeDate === selectedDate;
	});

	// Day summary
	const wins = dayTrades.filter((t: Trade) => Number(t.profit || 0) > 0);
	const losses = dayTrades.filter((t: Trade) => Number(t.profit || 0) < 0);
	const dayPnl = dayTrades.reduce((sum: number, t: Trade) => sum + Number(t.profit || 0), 0);
	const daySummary = dayTrades.length > 0 ? {
		pnl: dayPnl,
		totalTrades: dayTrades.length,
		wins: wins.length,
		losses: losses.length,
		winRate: dayTrades.length > 0 ? (wins.length / dayTrades.length) * 100 : 0,
		bestTrade: wins.length > 0 ? wins.reduce((max: number, t: Trade) => { const v = Number(t.profit); return v > max ? v : max; }, -Infinity) : 0,
		worstTrade: losses.length > 0 ? losses.reduce((min: number, t: Trade) => { const v = Number(t.profit); return v < min ? v : min; }, Infinity) : 0,
	} : null;

	// Week View: get the week containing selectedDate
	let weekData = null;
	if (viewMode === 'week') {
		const selectedDateObj = new Date(selectedDate + 'T00:00:00');
		const dayOfWeek = selectedDateObj.getDay(); // 0=Sun
		const weekStart = new Date(selectedDateObj);
		weekStart.setDate(weekStart.getDate() - dayOfWeek);
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekEnd.getDate() + 6);

		const weekStartStr = weekStart.toISOString().split('T')[0];
		const weekEndStr = weekEnd.toISOString().split('T')[0];

		const weekTrades = trades.filter((t: Trade) => {
			const d = toThaiDateString(t.close_time);
			return d >= weekStartStr && d <= weekEndStr;
		});

		// Group by day of week
		const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์'];
		const dayCards = dayNames.map((name, i) => {
			const dayDate = new Date(weekStart);
			dayDate.setDate(dayDate.getDate() + i);
			const dayStr = dayDate.toISOString().split('T')[0];
			const dayTr = weekTrades.filter((t: Trade) => toThaiDateString(t.close_time) === dayStr);
			const pnl = dayTr.reduce((sum: number, t: Trade) => sum + Number(t.profit || 0), 0);
			return {
				day: name,
				date: dayStr,
				trades: dayTr.length,
				pnl,
				hasData: dayTr.length > 0
			};
		});

		const weekWins = weekTrades.filter((t: Trade) => Number(t.profit || 0) > 0);
		const weekLosses = weekTrades.filter((t: Trade) => Number(t.profit || 0) < 0);
		const weekPnl = weekTrades.reduce((sum: number, t: Trade) => sum + Number(t.profit || 0), 0);
		const totalWinning = weekWins.reduce((sum: number, t: Trade) => sum + Number(t.profit || 0), 0);
		const totalLosing = Math.abs(weekLosses.reduce((sum: number, t: Trade) => sum + Number(t.profit || 0), 0));

		weekData = {
			weekStart: weekStartStr,
			weekEnd: weekEndStr,
			dayCards,
			trades: weekTrades,
			stats: {
				totalTrades: weekTrades.length,
				winRate: weekTrades.length > 0 ? (weekWins.length / weekTrades.length) * 100 : 0,
				grossPnl: weekPnl,
				profitFactor: totalLosing > 0 ? totalWinning / totalLosing : 0,
				winners: weekWins.length,
				losers: weekLosses.length,
				commissions: weekTrades.reduce((sum: number, t: Trade) => sum + Math.abs(Number(t.commission || 0)), 0)
			}
		};
	}

	// Intraday cumulative P&L series for mini chart
	let intradayCumPnl: Array<{ time: number; value: number }> = [];
	if (dayTrades.length > 0) {
		let cumPnl = 0;
		intradayCumPnl = [...dayTrades]
			.sort((a: Trade, b: Trade) => new Date(a.close_time).getTime() - new Date(b.close_time).getTime())
			.map((t: Trade) => {
				cumPnl += Number(t.profit || 0);
				return { time: Math.floor(new Date(t.close_time).getTime() / 1000), value: cumPnl };
			});
	}

	// Calendar data: P&L per day for current month
	const calendarDays = dailyHistory.map(d => ({
		date: d.date,
		pnl: d.profit,
		trades: d.totalTrades
	}));

	// Compute day-level insights
	const dayInsights = dayTrades.length > 0
		? evaluateDayInsights(dayTrades, trades)
		: [];

	return {
		selectedDate,
		viewMode,
		dayTrades,
		daySummary,
		weekData,
		calendarDays,
		intradayCumPnl,
		dayInsights
	};
};

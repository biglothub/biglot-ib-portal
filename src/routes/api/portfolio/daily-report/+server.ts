/**
 * ADV-009: Automated Daily Report email
 *
 * GET  — fetch current user's email report settings
 * PUT  — update email report settings
 * POST — generate and send daily/test report email immediately
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import {
	buildDailyHistory,
	buildKpiMetrics,
	buildRuleBreakMetrics,
	buildJournalCompletionSummary
} from '$lib/server/portfolio';
import { sendEmail, buildDailyReportHtml, buildWeeklyDigestHtml } from '$lib/server/email';
import { toThaiDateString } from '$lib/utils';

export interface EmailReportSettings {
	id: string;
	daily_enabled: boolean;
	daily_send_hour: number;
	weekly_enabled: boolean;
	weekly_day: number;
	last_daily_sent_at: string | null;
	last_weekly_sent_at: string | null;
}

// ---------------------------------------------------------------------------
// GET — load settings
// ---------------------------------------------------------------------------
export const GET: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const { data } = await locals.supabase
		.from('email_report_settings')
		.select('id, daily_enabled, daily_send_hour, weekly_enabled, weekly_day, last_daily_sent_at, last_weekly_sent_at')
		.eq('user_id', profile.id)
		.maybeSingle();

	// Return defaults if no row yet
	const settings: EmailReportSettings = data ?? {
		id: '',
		daily_enabled: false,
		daily_send_hour: 20,
		weekly_enabled: false,
		weekly_day: 0,
		last_daily_sent_at: null,
		last_weekly_sent_at: null
	};

	return json({ settings });
};

// ---------------------------------------------------------------------------
// PUT — upsert settings
// ---------------------------------------------------------------------------
export const PUT: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const body = await request.json() as Partial<{
		daily_enabled: boolean;
		daily_send_hour: number;
		weekly_enabled: boolean;
		weekly_day: number;
	}>;

	// Validate
	if (body.daily_send_hour !== undefined) {
		const h = body.daily_send_hour;
		if (!Number.isInteger(h) || h < 0 || h > 23) {
			return json({ message: 'ชั่วโมงไม่ถูกต้อง (0-23)' }, { status: 400 });
		}
	}
	if (body.weekly_day !== undefined) {
		const d = body.weekly_day;
		if (!Number.isInteger(d) || d < 0 || d > 6) {
			return json({ message: 'วันไม่ถูกต้อง (0-6)' }, { status: 400 });
		}
	}

	const { data, error } = await locals.supabase
		.from('email_report_settings')
		.upsert(
			{ user_id: profile.id, ...body },
			{ onConflict: 'user_id' }
		)
		.select('id, daily_enabled, daily_send_hour, weekly_enabled, weekly_day, last_daily_sent_at, last_weekly_sent_at')
		.single();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ settings: data });
};

// ---------------------------------------------------------------------------
// POST — send report now (for "Send Test" button or scheduled trigger)
// ---------------------------------------------------------------------------
export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const body = await request.json() as { type: 'daily' | 'weekly'; test?: boolean };
	const { type, test = false } = body;

	if (type !== 'daily' && type !== 'weekly') {
		return json({ message: 'type ต้องเป็น daily หรือ weekly' }, { status: 400 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'ไม่พบบัญชีที่อนุมัติแล้ว' }, { status: 404 });
	}

	const supabase = locals.supabase;

	// Fetch today's trades (UTC day)
	const now = new Date();
	const todayStr = now.toISOString().split('T')[0];

	if (type === 'daily') {
		// Fetch today's trades
		const { data: trades } = await supabase
			.from('trades')
			.select('*, trade_reviews(id, broken_rules, followed_plan)')
			.eq('client_account_id', account.id)
			.gte('close_time', `${todayStr}T00:00:00`)
			.lte('close_time', `${todayStr}T23:59:59`)
			.order('close_time', { ascending: false });

		// Fetch today's journal
		const { data: journals } = await supabase
			.from('daily_journal')
			.select('id, date')
			.eq('client_account_id', account.id)
			.eq('user_id', profile.id)
			.eq('date', todayStr);

		// Fetch today's checklist completions
		const { data: checklists } = await supabase
			.from('daily_checklist_completions')
			.select('id, completed')
			.eq('user_id', profile.id)
			.eq('date', todayStr);

		const periodTrades = (trades ?? []) as Array<{
			profit: string | number;
			symbol: string;
			trade_reviews?: Array<{ broken_rules?: string[] }>;
		}>;

		const dailyHistory = buildDailyHistory(periodTrades as never);
		const kpi = buildKpiMetrics(periodTrades as never, dailyHistory);
		const ruleBreaks = buildRuleBreakMetrics(periodTrades as never);

		// Best / worst trade
		const sorted = [...periodTrades].sort(
			(a, b) => Number(b.profit ?? 0) - Number(a.profit ?? 0)
		);
		const topWinner =
			sorted.length > 0 && Number(sorted[0].profit) > 0
				? { symbol: sorted[0].symbol, profit: Number(sorted[0].profit) }
				: null;
		const topLoser =
			sorted.length > 0 && Number(sorted[sorted.length - 1].profit) < 0
				? {
						symbol: sorted[sorted.length - 1].symbol,
						profit: Number(sorted[sorted.length - 1].profit)
					}
				: null;

		const checklistItems = checklists ?? [];
		const checklistTotal = checklistItems.length;
		const checklistCompleted = checklistItems.filter((c) => c.completed).length;

		const html = buildDailyReportHtml({
			userName: profile.full_name ?? 'Trader',
			date: toThaiDateString(now.toISOString()),
			netPnl: kpi.netPnl,
			totalTrades: kpi.totalTrades,
			winningTrades: kpi.winningTrades,
			losingTrades: kpi.losingTrades,
			winRate: kpi.tradeWinRate,
			profitFactor: kpi.profitFactor,
			avgWin: kpi.avgWin,
			avgLoss: Math.abs(kpi.avgLoss),
			ruleBreaks: ruleBreaks.totalBreaks,
			journalCompleted: (journals ?? []).length > 0,
			topWinner,
			topLoser,
			checklistCompleted,
			checklistTotal
		});

		const result = await sendEmail({
			to: profile.email,
			subject: `📊 สรุปผลการเทรดวันที่ ${toThaiDateString(now.toISOString())}`,
			html
		});

		if (!result.ok) {
			return json({ message: `ส่งอีเมลไม่สำเร็จ: ${result.error}` }, { status: 502 });
		}

		// Update last_daily_sent_at (skip for test sends)
		if (!test) {
			await supabase
				.from('email_report_settings')
				.upsert(
					{ user_id: profile.id, last_daily_sent_at: new Date().toISOString() },
					{ onConflict: 'user_id' }
				);
		}

		return json({ ok: true, message: 'ส่งรายงานรายวันสำเร็จ' });
	}

	// type === 'weekly'
	// Compute week range (Mon–Sun of current week)
	const dayOfWeek = now.getUTCDay(); // 0=Sun
	const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	const monday = new Date(now);
	monday.setUTCDate(now.getUTCDate() + mondayOffset);
	monday.setUTCHours(0, 0, 0, 0);
	const sunday = new Date(monday);
	sunday.setUTCDate(monday.getUTCDate() + 6);

	const weekStart = monday.toISOString().split('T')[0];
	const weekEnd = sunday.toISOString().split('T')[0];

	const { data: weekTrades } = await supabase
		.from('trades')
		.select('*, trade_reviews(id, broken_rules)')
		.eq('client_account_id', account.id)
		.gte('close_time', `${weekStart}T00:00:00`)
		.lte('close_time', `${weekEnd}T23:59:59`);

	const { data: weekJournals } = await supabase
		.from('daily_journal')
		.select('*')
		.eq('client_account_id', account.id)
		.eq('user_id', profile.id)
		.gte('date', weekStart)
		.lte('date', weekEnd);

	const periodTrades = (weekTrades ?? []) as never[];
	const dailyHistory = buildDailyHistory(periodTrades);
	const kpi = buildKpiMetrics(periodTrades, dailyHistory);
	const ruleBreaks = buildRuleBreakMetrics(periodTrades);
	const journalSummary = buildJournalCompletionSummary(weekJournals ?? [], dailyHistory);

	// Top symbol by net P&L
	const symbolMap = new Map<string, { netPnl: number; trades: number; wins: number }>();
	for (const t of weekTrades ?? []) {
		const s = symbolMap.get(t.symbol) ?? { netPnl: 0, trades: 0, wins: 0 };
		s.netPnl += Number(t.profit ?? 0);
		s.trades++;
		if (Number(t.profit ?? 0) > 0) s.wins++;
		symbolMap.set(t.symbol, s);
	}
	const topSymbolEntry = [...symbolMap.entries()].sort((a, b) => b[1].netPnl - a[1].netPnl)[0];
	const topSymbol = topSymbolEntry
		? {
				symbol: topSymbolEntry[0],
				netPnl: topSymbolEntry[1].netPnl,
				winRate:
					topSymbolEntry[1].trades > 0
						? (topSymbolEntry[1].wins / topSymbolEntry[1].trades) * 100
						: 0
			}
		: null;

	const weekLabel = `${toThaiDateString(weekStart + 'T00:00:00')}–${toThaiDateString(weekEnd + 'T00:00:00')}`;

	const html = buildWeeklyDigestHtml({
		userName: profile.full_name ?? 'Trader',
		weekLabel,
		netPnl: kpi.netPnl,
		totalTrades: kpi.totalTrades,
		winRate: kpi.tradeWinRate,
		profitFactor: kpi.profitFactor,
		dayWinRate: kpi.dayWinRate,
		topSymbol,
		ruleBreakCount: ruleBreaks.totalBreaks,
		journalStreak: journalSummary.currentStreak
	});

	const result = await sendEmail({
		to: profile.email,
		subject: `📈 สรุปรายสัปดาห์ ${weekLabel}`,
		html
	});

	if (!result.ok) {
		return json({ message: `ส่งอีเมลไม่สำเร็จ: ${result.error}` }, { status: 502 });
	}

	if (!test) {
		await supabase
			.from('email_report_settings')
			.upsert(
				{ user_id: profile.id, last_weekly_sent_at: new Date().toISOString() },
				{ onConflict: 'user_id' }
			);
	}

	return json({ ok: true, message: 'ส่งสรุปรายสัปดาห์สำเร็จ' });
};

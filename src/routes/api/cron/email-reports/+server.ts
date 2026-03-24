/**
 * POST /api/cron/email-reports
 *
 * Batch email sender invoked by an external cron service.
 * Body: { "type": "daily" | "weekly" }
 * Auth: Authorization: Bearer {CRON_SECRET}
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import {
	buildDailyHistory,
	buildKpiMetrics,
	buildRuleBreakMetrics,
	buildJournalCompletionSummary
} from '$lib/server/portfolio';
import { sendEmail, buildDailyReportHtml, buildWeeklyDigestHtml } from '$lib/server/email';
import { toThaiDateString } from '$lib/utils';

export const POST: RequestHandler = async ({ request }) => {
	// --- Auth check ---
	const authHeader = request.headers.get('authorization') ?? '';
	const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
	const cronSecret = env.CRON_SECRET ?? '';

	if (!cronSecret || token !== cronSecret) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// --- Parse body ---
	const { type } = (await request.json()) as { type: string };
	if (type !== 'daily' && type !== 'weekly') {
		return json({ error: 'type must be "daily" or "weekly"' }, { status: 400 });
	}

	const supabase = createSupabaseServiceClient();
	const now = new Date();

	// --- Query eligible users ---
	let settingsQuery = supabase
		.from('email_report_settings')
		.select('user_id, last_daily_sent_at, last_weekly_sent_at');

	if (type === 'daily') {
		const currentHour = now.getUTCHours();
		settingsQuery = settingsQuery
			.eq('daily_enabled', true)
			.eq('daily_send_hour', currentHour);
	} else {
		const currentDay = now.getUTCDay();
		settingsQuery = settingsQuery
			.eq('weekly_enabled', true)
			.eq('weekly_day', currentDay);
	}

	const { data: settings, error: settingsError } = await settingsQuery;
	if (settingsError) {
		return json({ error: settingsError.message }, { status: 500 });
	}

	let sent = 0;
	let skipped = 0;
	let errors = 0;

	const todayStr = now.toISOString().split('T')[0];

	for (const setting of settings ?? []) {
		try {
			// --- Dedup check ---
			if (type === 'daily' && setting.last_daily_sent_at) {
				const lastDate = new Date(setting.last_daily_sent_at).toISOString().split('T')[0];
				if (lastDate === todayStr) {
					skipped++;
					continue;
				}
			}
			if (type === 'weekly' && setting.last_weekly_sent_at) {
				const lastSent = new Date(setting.last_weekly_sent_at).getTime();
				const sixDaysAgo = now.getTime() - 6 * 24 * 60 * 60 * 1000;
				if (lastSent > sixDaysAgo) {
					skipped++;
					continue;
				}
			}

			// --- Get user info ---
			const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(setting.user_id);
			if (userError || !user?.email) {
				errors++;
				continue;
			}

			// --- Get user profile for name ---
			const { data: profile } = await supabase
				.from('profiles')
				.select('full_name, role')
				.eq('id', setting.user_id)
				.single();

			if (!profile || profile.role !== 'client') {
				skipped++;
				continue;
			}

			const userName = profile.full_name ?? 'Trader';

			// --- Get user's approved account ---
			const { data: account } = await supabase
				.from('client_accounts')
				.select('id')
				.eq('user_id', setting.user_id)
				.eq('status', 'approved')
				.maybeSingle();

			if (!account) {
				skipped++;
				continue;
			}

			if (type === 'daily') {
				await sendDailyReport(supabase, setting.user_id, user.email, userName, account.id, now, todayStr);
			} else {
				await sendWeeklyReport(supabase, setting.user_id, user.email, userName, account.id, now);
			}

			sent++;
		} catch {
			errors++;
		}
	}

	return json({ sent, skipped, errors });
};

// ---------------------------------------------------------------------------
// Daily report helper
// ---------------------------------------------------------------------------
async function sendDailyReport(
	supabase: ReturnType<typeof createSupabaseServiceClient>,
	userId: string,
	email: string,
	userName: string,
	accountId: string,
	now: Date,
	todayStr: string
) {
	const { data: trades } = await supabase
		.from('trades')
		.select('*, trade_reviews(id, broken_rules, followed_plan)')
		.eq('client_account_id', accountId)
		.gte('close_time', `${todayStr}T00:00:00`)
		.lte('close_time', `${todayStr}T23:59:59`)
		.order('close_time', { ascending: false });

	const { data: journals } = await supabase
		.from('daily_journal')
		.select('id, date')
		.eq('client_account_id', accountId)
		.eq('user_id', userId)
		.eq('date', todayStr);

	const { data: checklists } = await supabase
		.from('daily_checklist_completions')
		.select('id, completed')
		.eq('user_id', userId)
		.eq('date', todayStr);

	const periodTrades = (trades ?? []) as never[];
	const dailyHistory = buildDailyHistory(periodTrades);
	const kpi = buildKpiMetrics(periodTrades, dailyHistory);
	const ruleBreaks = buildRuleBreakMetrics(periodTrades);

	// Best / worst trade
	const sorted = [...(trades ?? [])].sort(
		(a, b) => Number(b.profit ?? 0) - Number(a.profit ?? 0)
	);
	const topWinner =
		sorted.length > 0 && Number(sorted[0].profit) > 0
			? { symbol: sorted[0].symbol, profit: Number(sorted[0].profit) }
			: null;
	const topLoser =
		sorted.length > 0 && Number(sorted[sorted.length - 1].profit) < 0
			? { symbol: sorted[sorted.length - 1].symbol, profit: Number(sorted[sorted.length - 1].profit) }
			: null;

	const checklistItems = checklists ?? [];
	const checklistTotal = checklistItems.length;
	const checklistCompleted = checklistItems.filter((c) => c.completed).length;

	const html = buildDailyReportHtml({
		userName,
		date: toThaiDateString(now.toISOString()),
		netPnl: kpi.netPnl,
		totalTrades: kpi.totalTrades,
		winningTrades: kpi.winningTrades,
		losingTrades: kpi.losingTrades,
		winRate: kpi.tradeWinRate,
		profitFactor: kpi.profitFactor,
		avgWin: kpi.avgWin,
		avgLoss: Math.abs(kpi.avgLoss),
		ruleBreaks: ruleBreaks.totalRuleBreaks,
		journalCompleted: (journals ?? []).length > 0,
		topWinner,
		topLoser,
		checklistCompleted,
		checklistTotal
	});

	const result = await sendEmail({
		to: email,
		subject: `📊 สรุปผลการเทรดวันที่ ${toThaiDateString(now.toISOString())}`,
		html
	});

	if (!result.ok) {
		throw new Error(result.error ?? 'Failed to send email');
	}

	await supabase
		.from('email_report_settings')
		.update({ last_daily_sent_at: new Date().toISOString() })
		.eq('user_id', userId);
}

// ---------------------------------------------------------------------------
// Weekly report helper
// ---------------------------------------------------------------------------
async function sendWeeklyReport(
	supabase: ReturnType<typeof createSupabaseServiceClient>,
	userId: string,
	email: string,
	userName: string,
	accountId: string,
	now: Date
) {
	const dayOfWeek = now.getUTCDay();
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
		.eq('client_account_id', accountId)
		.gte('close_time', `${weekStart}T00:00:00`)
		.lte('close_time', `${weekEnd}T23:59:59`);

	const { data: weekJournals } = await supabase
		.from('daily_journal')
		.select('*')
		.eq('client_account_id', accountId)
		.eq('user_id', userId)
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
		userName,
		weekLabel,
		netPnl: kpi.netPnl,
		totalTrades: kpi.totalTrades,
		winRate: kpi.tradeWinRate,
		profitFactor: kpi.profitFactor,
		dayWinRate: kpi.dayWinRate,
		topSymbol,
		ruleBreakCount: ruleBreaks.totalRuleBreaks,
		journalStreak: journalSummary.currentStreak
	});

	const result = await sendEmail({
		to: email,
		subject: `📈 สรุปรายสัปดาห์ ${weekLabel}`,
		html
	});

	if (!result.ok) {
		throw new Error(result.error ?? 'Failed to send email');
	}

	await supabase
		.from('email_report_settings')
		.update({ last_weekly_sent_at: new Date().toISOString() })
		.eq('user_id', userId);
}

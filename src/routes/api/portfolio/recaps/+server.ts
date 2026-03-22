import { env } from '$env/dynamic/private';
import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import type { TradeTagAssignment } from '$lib/types';
import {
	buildDailyHistory,
	buildKpiMetrics,
	buildRuleBreakMetrics,
	buildSetupPerformance,
	buildSymbolBreakdown,
	buildJournalCompletionSummary
} from '$lib/server/portfolio';
import { buildRecapPrompt } from '$lib/server/recap-prompt';
import { rateLimit } from '$lib/server/rate-limit';
import { toThaiDateString } from '$lib/utils';
import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import type { RequestHandler } from './$types';

const SECTIONS = ['PERFORMANCE_SUMMARY', 'PATTERNS', 'MISTAKES', 'STRENGTHS', 'ACTION_PLAN'] as const;
const SECTION_REGEX = /<<<(PERFORMANCE_SUMMARY|PATTERNS|MISTAKES|STRENGTHS|ACTION_PLAN)>>>/;

/** GET: Fetch cached recap for a period */
export const GET: RequestHandler = async ({ locals, url }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ recap: null });
	}

	const periodType = url.searchParams.get('period_type') || 'week';
	const periodStart = url.searchParams.get('period_start');
	if (!periodStart) {
		return json({ recap: null });
	}

	const { data } = await locals.supabase
		.from('trading_recaps')
		.select('*')
		.eq('client_account_id', account.id)
		.eq('user_id', profile.id)
		.eq('period_type', periodType)
		.eq('period_start', periodStart)
		.maybeSingle();

	return json({ recap: data });
};

/** POST: Generate new recap with AI streaming */
export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return new Response(JSON.stringify({ message: 'ไม่ได้รับอนุญาต' }), { status: 403 });
	}

	if (!(await rateLimit(`portfolio:recaps:${profile.id}`, 3, 3_600_000))) {
		return new Response(JSON.stringify({ message: 'Rate limit exceeded' }), { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return new Response(JSON.stringify({ message: 'No approved account' }), { status: 404 });
	}

	const body = await request.json();
	const { period_type, period_start, period_end } = body;

	if (!period_type || !period_start || !period_end) {
		return new Response(JSON.stringify({ message: 'Missing period parameters' }), { status: 400 });
	}

	if (period_type !== 'week' && period_type !== 'month') {
		return new Response(JSON.stringify({ message: 'Invalid period_type' }), { status: 400 });
	}

	const supabase = locals.supabase;

	// Fetch trades for current period
	const { data: trades } = await supabase
		.from('trades')
		.select('*, trade_tag_assignments(id, tag_id, trade_tags(id, name, color, category)), trade_reviews(id, review_status, playbook_id, broken_rules, followed_plan, playbooks(id, name)), trade_attachments(id), trade_notes(id)')
		.eq('client_account_id', account.id)
		.gte('close_time', `${period_start}T00:00:00`)
		.lte('close_time', `${period_end}T23:59:59`)
		.order('close_time', { ascending: false });

	const periodTrades = trades || [];

	// Fetch journals for the period
	const { data: journals } = await supabase
		.from('daily_journal')
		.select('*')
		.eq('client_account_id', account.id)
		.eq('user_id', profile.id)
		.gte('date', period_start)
		.lte('date', period_end);

	// Compute current period stats
	const dailyHistory = buildDailyHistory(periodTrades);
	const kpi = buildKpiMetrics(periodTrades, dailyHistory);
	const symbolBreakdown = buildSymbolBreakdown(periodTrades);
	const ruleBreaks = buildRuleBreakMetrics(periodTrades);
	const setupPerformance = buildSetupPerformance(periodTrades);
	const journalSummary = buildJournalCompletionSummary(journals || [], dailyHistory);

	// Compute previous period stats for comparison
	const periodDays = Math.round((new Date(period_end).getTime() - new Date(period_start).getTime()) / 86400000) + 1;
	const prevStart = new Date(new Date(period_start).getTime() - periodDays * 86400000).toISOString().split('T')[0];
	const prevEnd = new Date(new Date(period_start).getTime() - 86400000).toISOString().split('T')[0];

	const { data: prevTrades } = await supabase
		.from('trades')
		.select('id, profit, close_time')
		.eq('client_account_id', account.id)
		.gte('close_time', `${prevStart}T00:00:00`)
		.lte('close_time', `${prevEnd}T23:59:59`);

	let prevStats = null;
	if (prevTrades && prevTrades.length > 0) {
		const prevDailyHistory = buildDailyHistory(prevTrades as any);
		const prevKpi = buildKpiMetrics(prevTrades as any, prevDailyHistory);
		prevStats = {
			netPnl: prevKpi.netPnl,
			totalTrades: prevKpi.totalTrades,
			tradeWinRate: prevKpi.tradeWinRate,
			profitFactor: prevKpi.profitFactor >= 999 ? 0 : prevKpi.profitFactor
		};
	}

	// Mistake tags
	const mistakeStats: { name: string; count: number; cost: number }[] = [];
	for (const trade of periodTrades) {
		const mistakeTags = (trade.trade_tag_assignments || []).filter(
			(a: TradeTagAssignment) => a.trade_tags?.category === 'mistake'
		);
		for (const a of mistakeTags) {
			const name = a.trade_tags?.name || 'Mistake';
			const existing = mistakeStats.find(m => m.name === name);
			const loss = Number(trade.profit || 0) < 0 ? Math.abs(Number(trade.profit || 0)) : 0;
			if (existing) { existing.count++; existing.cost += loss; }
			else mistakeStats.push({ name, count: 1, cost: loss });
		}
	}

	// Best/worst trade
	const sortedByProfit = [...periodTrades].sort((a, b) => Number(b.profit || 0) - Number(a.profit || 0));
	const bestTrade = sortedByProfit.length > 0
		? { symbol: sortedByProfit[0].symbol, profit: Number(sortedByProfit[0].profit), date: toThaiDateString(sortedByProfit[0].close_time) }
		: null;
	const worstTrade = sortedByProfit.length > 0
		? { symbol: sortedByProfit[sortedByProfit.length - 1].symbol, profit: Number(sortedByProfit[sortedByProfit.length - 1].profit), date: toThaiDateString(sortedByProfit[sortedByProfit.length - 1].close_time) }
		: null;

	// Session stats from daily history
	const sessionMap = new Map<string, { profit: number; trades: number; wins: number }>();
	for (const trade of periodTrades) {
		const hour = new Date(trade.close_time).getUTCHours();
		const session = hour < 8 ? 'asian' : hour < 15 ? 'london' : 'newyork';
		const s = sessionMap.get(session) || { profit: 0, trades: 0, wins: 0 };
		s.trades++; s.profit += Number(trade.profit || 0);
		if (Number(trade.profit || 0) > 0) s.wins++;
		sessionMap.set(session, s);
	}
	const sessionStats = Array.from(sessionMap.entries()).map(([session, s]) => ({
		session, profit: s.profit, trades: s.trades, winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0
	}));

	// Build prompt context
	const promptContext = {
		periodType: period_type as 'week' | 'month',
		periodStart: period_start,
		periodEnd: period_end,
		stats: {
			netPnl: kpi.netPnl,
			totalTrades: kpi.totalTrades,
			winningTrades: kpi.winningTrades,
			losingTrades: kpi.losingTrades,
			tradeWinRate: kpi.tradeWinRate,
			profitFactor: kpi.profitFactor >= 999 ? 0 : kpi.profitFactor,
			dayWinRate: kpi.dayWinRate,
			avgWin: kpi.avgWin,
			avgLoss: kpi.avgLoss,
			totalTradingDays: kpi.totalTradingDays
		},
		prevStats,
		topSymbols: symbolBreakdown.slice(0, 5).map(s => ({
			symbol: s.symbol, netPnl: s.netPnl, trades: s.trades, winRate: s.winRate
		})),
		topBrokenRules: ruleBreaks.topRules.slice(0, 5),
		topMistakes: mistakeStats.sort((a, b) => b.cost - a.cost).slice(0, 5),
		sessionStats,
		journalCompletion: journalSummary.completionRate,
		journalStreak: journalSummary.currentStreak,
		bestTrade,
		worstTrade,
		playbookPerformance: setupPerformance.slice(0, 5).map(s => ({
			name: s.name, trades: s.totalTrades, winRate: s.winRate, netPnl: s.totalProfit
		}))
	};

	const systemPrompt = buildRecapPrompt(promptContext);
	const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

	// Stats to save
	const statsToSave = {
		netPnl: kpi.netPnl,
		totalTrades: kpi.totalTrades,
		tradeWinRate: kpi.tradeWinRate,
		profitFactor: kpi.profitFactor >= 999 ? 0 : kpi.profitFactor,
		dayWinRate: kpi.dayWinRate,
		avgWin: kpi.avgWin,
		avgLoss: kpi.avgLoss
	};

	// Streaming response
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (data: Record<string, unknown>) => {
				controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
			};

			// Send stats first so client can render KPI cards immediately
			send({ type: 'stats', stats: statsToSave, prevStats });

			try {
				const response = await openai.chat.completions.create({
					model: 'gpt-4o-mini',
					max_tokens: 3000,
					stream: true,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: `สรุปผลการเทรด${period_type === 'week' ? 'สัปดาห์' : 'เดือน'}นี้` }
					]
				});

				let buffer = '';
				let currentSection = '';
				const sectionContents: Record<string, string> = {};

				for await (const chunk of response) {
					const text = chunk.choices[0]?.delta?.content;
					if (!text) continue;

					buffer += text;

					while (true) {
						const match = buffer.match(SECTION_REGEX);
						if (!match) break;

						const delimiterIndex = match.index!;
						const sectionName = match[1].toLowerCase();

						if (currentSection && delimiterIndex > 0) {
							const beforeText = buffer.substring(0, delimiterIndex).trim();
							if (beforeText) {
								send({ type: 'text_delta', text: beforeText });
								sectionContents[currentSection] = (sectionContents[currentSection] || '') + beforeText;
							}
							send({ type: 'section_end', section: currentSection });
						}

						currentSection = sectionName;
						send({ type: 'section_start', section: sectionName });
						sectionContents[sectionName] = '';
						buffer = buffer.substring(delimiterIndex + match[0].length);
					}

					if (currentSection && buffer.length > 50) {
						const emitText = buffer.substring(0, buffer.length - 50);
						if (emitText) {
							send({ type: 'text_delta', text: emitText });
							sectionContents[currentSection] = (sectionContents[currentSection] || '') + emitText;
						}
						buffer = buffer.substring(buffer.length - 50);
					}
				}

				// Flush remaining
				if (currentSection && buffer.trim()) {
					send({ type: 'text_delta', text: buffer.trim() });
					sectionContents[currentSection] = (sectionContents[currentSection] || '') + buffer.trim();
					send({ type: 'section_end', section: currentSection });
				}

				// Save to database
				await supabase
					.from('trading_recaps')
					.upsert({
						user_id: profile.id,
						client_account_id: account.id,
						period_type,
						period_start,
						period_end,
						stats: statsToSave,
						sections: sectionContents,
						model: 'gpt-4o-mini'
					}, { onConflict: 'user_id,client_account_id,period_type,period_start' });

				send({ type: 'done' });
			} catch (err: unknown) {
				send({ type: 'error', message: err instanceof Error ? err.message : 'AI error' });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Transfer-Encoding': 'chunked',
			'Cache-Control': 'no-cache'
		}
	});
};

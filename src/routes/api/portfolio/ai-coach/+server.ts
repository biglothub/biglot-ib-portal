import { env } from '$env/dynamic/private';
import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import {
	buildDailyHistory,
	buildKpiMetrics,
	buildRuleBreakMetrics,
	buildSetupPerformance
} from '$lib/server/portfolio';
import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import OpenAI from 'openai';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!rateLimit(`ai-coach:${profile.id}`, 5, 3_600_000)) {
		return json({ message: 'สร้างคำแนะนำได้สูงสุด 5 ครั้ง/ชั่วโมง' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const since = thirtyDaysAgo.toISOString().split('T')[0];

	const { data: trades } = await locals.supabase
		.from('trades')
		.select(
			'*, trade_tag_assignments(id, tag_id, trade_tags(id, name, color, category)), trade_reviews(id, review_status, playbook_id, broken_rules, followed_plan, playbooks(id, name))'
		)
		.eq('client_account_id', account.id)
		.gte('close_time', `${since}T00:00:00`)
		.order('close_time', { ascending: false });

	const recentTrades = trades ?? [];

	if (recentTrades.length < 5) {
		return json({ coach: null, reason: 'insufficient_data' });
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const dailyHistory = buildDailyHistory(recentTrades as any);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const kpi = buildKpiMetrics(recentTrades as any, dailyHistory);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ruleBreaks = buildRuleBreakMetrics(recentTrades as any);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const setupPerf = buildSetupPerformance(recentTrades as any);

	// Session performance (UTC hour-based, same as recaps endpoint)
	const sessionMap = new Map<string, { profit: number; trades: number; wins: number }>();
	for (const trade of recentTrades) {
		const hour = new Date(trade.close_time as string).getUTCHours();
		const session = hour < 8 ? 'เอเชีย' : hour < 15 ? 'ลอนดอน' : 'นิวยอร์ก';
		const s = sessionMap.get(session) ?? { profit: 0, trades: 0, wins: 0 };
		s.trades++;
		s.profit += Number(trade.profit ?? 0);
		if (Number(trade.profit ?? 0) > 0) s.wins++;
		sessionMap.set(session, s);
	}
	const sessionStats = Array.from(sessionMap.entries())
		.map(([session, s]) => ({
			session,
			profit: s.profit,
			trades: s.trades,
			winRate: s.trades > 0 ? (s.wins / s.trades) * 100 : 0
		}))
		.sort((a, b) => b.winRate - a.winRate);

	// 3-hour UTC block analysis
	const hourMap = new Map<number, { profit: number; trades: number }>();
	for (const trade of recentTrades) {
		const utcHour = new Date(trade.close_time as string).getUTCHours();
		const h = hourMap.get(utcHour) ?? { profit: 0, trades: 0 };
		h.trades++;
		h.profit += Number(trade.profit ?? 0);
		hourMap.set(utcHour, h);
	}
	const hourBlocks: { label: string; avgPnl: number; trades: number }[] = [];
	for (let start = 0; start < 24; start += 3) {
		let blockProfit = 0;
		let blockTrades = 0;
		for (let h = start; h < start + 3; h++) {
			const d = hourMap.get(h);
			if (d) {
				blockProfit += d.profit;
				blockTrades += d.trades;
			}
		}
		if (blockTrades >= 2) {
			hourBlocks.push({
				label: `${String(start).padStart(2, '0')}:00-${String(start + 3).padStart(2, '0')}:00 UTC`,
				avgPnl: blockProfit / blockTrades,
				trades: blockTrades
			});
		}
	}
	const sortedBlocks = [...hourBlocks].sort((a, b) => a.avgPnl - b.avgPnl);
	const worstBlock = sortedBlocks[0] ?? null;
	const bestBlock = sortedBlocks[sortedBlocks.length - 1] ?? null;

	const profitFactor = kpi.profitFactor >= 999 ? 0 : kpi.profitFactor;

	const contextLines = [
		`ข้อมูลการเทรด 30 วันล่าสุด:`,
		`- จำนวนเทรด: ${kpi.totalTrades}`,
		`- Win Rate: ${kpi.tradeWinRate.toFixed(1)}%`,
		`- Day Win Rate: ${kpi.dayWinRate.toFixed(1)}%`,
		`- Profit Factor: ${profitFactor > 0 ? profitFactor.toFixed(2) : '∞'}`,
		`- Net P&L: $${kpi.netPnl.toFixed(2)}`,
		`- Avg Win: $${kpi.avgWin.toFixed(2)} | Avg Loss: $${kpi.avgLoss.toFixed(2)}`,
		``,
		`Session Performance:`,
		...sessionStats.map(
			(s) =>
				`- ${s.session}: ${s.winRate.toFixed(1)}% win, ${s.trades} trades, P&L: $${s.profit.toFixed(2)}`
		),
		``,
		worstBlock
			? `ช่วงเวลาที่ผลแย่ที่สุด: ${worstBlock.label} (avg $${worstBlock.avgPnl.toFixed(2)}/trade, ${worstBlock.trades} trades)`
			: '',
		bestBlock && bestBlock.label !== worstBlock?.label
			? `ช่วงเวลาที่ผลดีที่สุด: ${bestBlock.label} (avg $${bestBlock.avgPnl.toFixed(2)}/trade, ${bestBlock.trades} trades)`
			: '',
		``,
		`Top Broken Rules:`,
		...(ruleBreaks.topRules.length > 0
			? ruleBreaks.topRules
					.slice(0, 3)
					.map((r) => `- ${r.rule}: ${r.count}x (loss: $${r.loss.toFixed(2)})`)
			: ['- ไม่มีข้อมูล']),
		``,
		`Setup Performance:`,
		...(setupPerf.length > 0
			? setupPerf
					.slice(0, 3)
					.map(
						(s) =>
							`- ${s.name}: ${s.winRate.toFixed(1)}% win, ${s.totalTrades} trades, P&L: $${s.totalProfit.toFixed(2)}`
					)
			: ['- ไม่มีข้อมูล'])
	]
		.filter((l) => l !== undefined)
		.join('\n');

	const systemPrompt = `คุณเป็น AI Trade Coach ผู้เชี่ยวชาญวิเคราะห์รูปแบบการเทรด ตอบด้วย JSON เท่านั้น ห้ามมีข้อความอื่น
ตอบในรูปแบบ:
{
  "message": "คำแนะนำหลัก 1-2 ประโยค เฉพาะเจาะจงและนำไปปฏิบัติได้จริง อ้างอิงตัวเลขจริงจากข้อมูล",
  "insights": [
    {"category": "session", "title": "เซสชันที่ดีที่สุด", "value": "...", "sentiment": "positive"},
    {"category": "behavior", "title": "กฎที่ผิดบ่อยสุด", "value": "...", "sentiment": "negative"},
    {"category": "setup", "title": "Setup ที่แนะนำ", "value": "...", "sentiment": "positive"},
    {"category": "time", "title": "ช่วงเวลาที่ควรเลี่ยง", "value": "...", "sentiment": "negative"}
  ]
}
category ที่ใช้ได้: session, time, setup, behavior
sentiment: positive, negative, neutral
ถ้าไม่มีข้อมูลพอสำหรับ insight บางรายการ ให้ใช้ sentiment: neutral และบอกว่าไม่มีข้อมูลพอ`;

	try {
		const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			max_tokens: 500,
			response_format: { type: 'json_object' },
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: contextLines }
			]
		});

		const content = response.choices[0]?.message?.content ?? '{}';
		let parsed: { message?: string; insights?: unknown[] };
		try {
			parsed = JSON.parse(content);
		} catch {
			parsed = { message: 'ไม่สามารถวิเคราะห์ข้อมูลได้', insights: [] };
		}

		return json({
			coach: {
				message: typeof parsed.message === 'string' ? parsed.message : '',
				insights: Array.isArray(parsed.insights) ? parsed.insights : [],
				generatedAt: new Date().toISOString(),
				stats: {
					totalTrades: kpi.totalTrades,
					winRate: kpi.tradeWinRate,
					profitFactor
				}
			}
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'AI error';
		return json({ message }, { status: 500 });
	}
};

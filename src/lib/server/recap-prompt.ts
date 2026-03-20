interface RecapContext {
	periodType: 'week' | 'month';
	periodStart: string;
	periodEnd: string;
	stats: {
		netPnl: number;
		totalTrades: number;
		winningTrades: number;
		losingTrades: number;
		tradeWinRate: number;
		profitFactor: number;
		dayWinRate: number;
		avgWin: number;
		avgLoss: number;
		totalTradingDays: number;
	};
	prevStats: {
		netPnl: number;
		totalTrades: number;
		tradeWinRate: number;
		profitFactor: number;
	} | null;
	topSymbols: { symbol: string; netPnl: number; trades: number; winRate: number }[];
	topBrokenRules: { rule: string; count: number; loss: number }[];
	topMistakes: { name: string; count: number; cost: number }[];
	sessionStats: { session: string; profit: number; trades: number; winRate: number }[];
	journalCompletion: number;
	journalStreak: number;
	bestTrade: { symbol: string; profit: number; date: string } | null;
	worstTrade: { symbol: string; profit: number; date: string } | null;
	playbookPerformance: { name: string; trades: number; winRate: number; netPnl: number }[];
}

export function buildRecapPrompt(context: RecapContext): string {
	const periodLabel = context.periodType === 'week' ? 'สัปดาห์' : 'เดือน';
	const dateRange = `${context.periodStart} ถึง ${context.periodEnd}`;

	const { stats, prevStats } = context;

	const prevComparison = prevStats
		? `
เปรียบเทียบกับ${periodLabel}ก่อน:
- P&L: $${prevStats.netPnl.toFixed(2)} → $${stats.netPnl.toFixed(2)} (${stats.netPnl >= prevStats.netPnl ? '↑' : '↓'})
- Win Rate: ${prevStats.tradeWinRate.toFixed(1)}% → ${stats.tradeWinRate.toFixed(1)}%
- PF: ${prevStats.profitFactor.toFixed(2)} → ${stats.profitFactor.toFixed(2)}
- Trades: ${prevStats.totalTrades} → ${stats.totalTrades}`
		: 'ไม่มีข้อมูล' + periodLabel + 'ก่อนเพื่อเปรียบเทียบ';

	const symbolsContext = context.topSymbols.length > 0
		? context.topSymbols.map(s =>
			`${s.symbol}: ${s.trades} trades, WR ${s.winRate.toFixed(0)}%, P&L $${s.netPnl.toFixed(2)}`
		).join('\n')
		: 'ไม่มีข้อมูล';

	const brokenRulesContext = context.topBrokenRules.length > 0
		? context.topBrokenRules.map(r =>
			`${r.rule}: ${r.count} ครั้ง, ขาดทุน $${r.loss.toFixed(2)}`
		).join('\n')
		: 'ไม่มีกฎที่ถูกละเมิด';

	const mistakesContext = context.topMistakes.length > 0
		? context.topMistakes.map(m =>
			`${m.name}: ${m.count} ครั้ง, ต้นทุน $${m.cost.toFixed(2)}`
		).join('\n')
		: 'ไม่มี mistake tags';

	const sessionsContext = context.sessionStats
		.map(s => `${s.session}: ${s.trades} trades, WR ${s.winRate.toFixed(0)}%, P&L $${s.profit.toFixed(2)}`)
		.join('\n');

	const playbookContext = context.playbookPerformance.length > 0
		? context.playbookPerformance.map(p =>
			`${p.name}: ${p.trades} trades, WR ${p.winRate.toFixed(0)}%, P&L $${p.netPnl.toFixed(2)}`
		).join('\n')
		: 'ไม่มี playbook';

	const bestWorst = [
		context.bestTrade ? `Best: ${context.bestTrade.symbol} +$${context.bestTrade.profit.toFixed(2)} (${context.bestTrade.date})` : null,
		context.worstTrade ? `Worst: ${context.worstTrade.symbol} -$${Math.abs(context.worstTrade.profit).toFixed(2)} (${context.worstTrade.date})` : null,
	].filter(Boolean).join('\n');

	return `คุณเป็นโค้ชการเทรดมืออาชีพ วิเคราะห์ผลการเทรดและให้คำแนะนำเป็นภาษาไทย

=== ข้อมูลบริบท ===

📅 ช่วงเวลา: ${dateRange} (${periodLabel}นี้)

📊 ผลการเทรด:
- Net P&L: $${stats.netPnl.toFixed(2)}
- Total Trades: ${stats.totalTrades} (${stats.winningTrades} ชนะ / ${stats.losingTrades} แพ้)
- Win Rate: ${stats.tradeWinRate.toFixed(1)}%
- Profit Factor: ${stats.profitFactor.toFixed(2)}
- Day Win Rate: ${stats.dayWinRate.toFixed(1)}% (${stats.totalTradingDays} วันที่เทรด)
- Avg Win: $${stats.avgWin.toFixed(2)} | Avg Loss: $${stats.avgLoss.toFixed(2)}

📈 ${prevComparison}

🏆 Best/Worst Trade:
${bestWorst || 'ไม่มีข้อมูล'}

💹 Symbol Performance:
${symbolsContext}

⏰ Session Performance:
${sessionsContext}

📋 Playbook Performance:
${playbookContext}

⚠️ Broken Rules:
${brokenRulesContext}

🏷️ Mistake Tags:
${mistakesContext}

📓 Journal: ${context.journalCompletion.toFixed(0)}% completion, streak ${context.journalStreak} วัน

=== คำสั่ง ===

สรุปผลการเทรด${periodLabel}นี้ แบ่งเป็น 5 ส่วน ใช้ delimiters <<<SECTION_NAME>>> ก่อนเริ่มแต่ละส่วน:

<<<PERFORMANCE_SUMMARY>>>
สรุปภาพรวมผลการเทรด:
- สรุป P&L และสถิติสำคัญ
- เปรียบเทียบกับ${periodLabel}ก่อน (ดีขึ้น/แย่ลง)
- Highlight best/worst trade พร้อมบทเรียน
- ให้คะแนนภาพรวม (A-F grade)

<<<PATTERNS>>>
วิเคราะห์ patterns ที่พบ:
- ช่วงเวลา/session ไหนเทรดได้ดี/แย่
- Symbol ไหน perform ดี/แย่ เพราะอะไร
- มี pattern ซ้ำๆ ในการเทรดหรือไม่ (เช่น revenge trading, overtrade ช่วงบ่าย)
- ใช้ตัวเลขประกอบเสมอ

<<<MISTAKES>>>
ข้อผิดพลาดที่ต้องแก้:
- กฎที่ถูกละเมิดบ่อยที่สุดและต้นทุนที่เกิดขึ้น
- Mistake tags ที่พบบ่อย
- สาเหตุที่เป็นไปได้ของข้อผิดพลาดซ้ำๆ
- เรียงตามความรุนแรง (ต้นทุนสูงสุดก่อน)

<<<STRENGTHS>>>
จุดแข็งที่ควรรักษา:
- Setup/playbook ไหนทำกำไรดี
- นิสัยการเทรดที่ดี (journal completion, discipline)
- Consistency ที่น่าชื่นชม
- Highlight สิ่งที่ทำได้ดีเพื่อเสริมกำลังใจ

<<<ACTION_PLAN>>>
แผนปรับปรุงสำหรับ${periodLabel}หน้า:
- 🟢 สิ่งที่ควรทำต่อ (2-3 ข้อ)
- 🔴 สิ่งที่ควรหยุด/ลด (2-3 ข้อ)
- 🎯 เป้าหมายที่เป็นรูปธรรม (ตัวเลขชัดเจน)
- กระชับ นำไปปฏิบัติได้จริง

หมายเหตุ: ใช้ตัวเลขประกอบทุกจุด กระชับแต่ครอบคลุม ให้กำลังใจแต่ตรงไปตรงมา`;
}

interface AnalysisContext {
	news: { title_th: string; summary_th: string; category: string; published_at: string }[];
	trades: { symbol: string; type: string; profit: number; open_time: string; close_time: string; lot_size: number }[];
	openPositions: { symbol: string; type: string; lot_size: number; open_price: number; current_price: number; current_profit: number; sl: number; tp: number }[];
	journal: { market_bias: string; key_levels: string; session_plan: string; pre_market_notes: string } | null;
	playbooks: { name: string; entry_criteria: string; exit_criteria: string; risk_rules: string }[];
	dailyStats: { date: string; balance: number; equity: number; profit: number; win_rate: number; profit_factor: number; max_drawdown: number }[];
}

export function buildAnalysisPrompt(context: AnalysisContext): string {
	const newsContext = context.news.length > 0
		? context.news.map((n, i) => `${i + 1}. [${n.category}] ${n.title_th}\n   ${n.summary_th} (${new Date(n.published_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })})`).join('\n')
		: 'ไม่มีข่าวล่าสุด';

	const tradesContext = context.trades.length > 0
		? context.trades.slice(0, 15).map(t =>
			`${t.type.toUpperCase()} ${t.lot_size} lot | ${new Date(t.close_time).toLocaleDateString('th-TH')} | P/L: $${t.profit}`
		).join('\n')
		: 'ไม่มีเทรดล่าสุด';

	const positionsContext = context.openPositions.length > 0
		? context.openPositions.map(p =>
			`${p.type.toUpperCase()} ${p.lot_size} lot @ ${p.open_price} | Current: ${p.current_price} | P/L: $${p.current_profit} | SL: ${p.sl || 'N/A'} | TP: ${p.tp || 'N/A'}`
		).join('\n')
		: 'ไม่มี position ที่เปิดอยู่';

	const journalContext = context.journal
		? `- Market Bias ที่บันทึก: ${context.journal.market_bias || 'ไม่ได้ระบุ'}
- Key Levels ที่บันทึก: ${context.journal.key_levels || 'ไม่ได้ระบุ'}
- Session Plan: ${context.journal.session_plan || 'ไม่ได้ระบุ'}
- Pre-market Notes: ${context.journal.pre_market_notes || 'ไม่ได้ระบุ'}`
		: 'ไม่มี journal วันนี้';

	const playbooksContext = context.playbooks.length > 0
		? context.playbooks.map(p =>
			`📋 ${p.name}\n   Entry: ${p.entry_criteria || 'N/A'}\n   Exit: ${p.exit_criteria || 'N/A'}\n   Risk: ${p.risk_rules || 'N/A'}`
		).join('\n')
		: 'ไม่มี playbook';

	const statsContext = context.dailyStats.length > 0
		? (() => {
			const latest = context.dailyStats[0];
			return `Balance: $${latest.balance?.toLocaleString()} | Equity: $${latest.equity?.toLocaleString()} | Win Rate: ${latest.win_rate ?? 'N/A'}% | PF: ${latest.profit_factor ?? 'N/A'} | Max DD: ${latest.max_drawdown ?? 'N/A'}%`;
		})()
		: 'ไม่มีข้อมูลสถิติ';

	return `คุณเป็นนักวิเคราะห์ตลาดทองคำ (XAUUSD) มืออาชีพ เชี่ยวชาญ ICT/Smart Money Concepts
ตอบเป็นภาษาไทยเสมอ วิเคราะห์สำหรับ intraday/daily timeframe

=== ข้อมูลบริบท ===

📰 ข่าวตลาดล่าสุด (24 ชม.):
${newsContext}

📊 ประวัติเทรด XAUUSD ล่าสุด (30 วัน):
${tradesContext}

📌 Positions ที่เปิดอยู่ (XAUUSD):
${positionsContext}

📓 Journal ล่าสุด:
${journalContext}

📋 Playbooks ที่ใช้งาน:
${playbooksContext}

💰 สถิติล่าสุด:
${statsContext}

=== คำสั่ง ===

วิเคราะห์ตลาดทองคำ (XAUUSD) โดยแบ่งเป็น 6 ส่วน ใช้ delimiters <<<SECTION_NAME>>> ก่อนเริ่มแต่ละส่วน:

<<<MARKET_BIAS>>>
ประเมินทิศทางตลาดทองคำโดยรวม:
- แนวโน้มหลัก (Bullish/Bearish/Neutral/Range)
- เหตุผลจากข่าว, ปัจจัยพื้นฐาน (DXY, Fed, อัตราดอกเบี้ย, geopolitics)
- ความแข็งแกร่งของ bias (Strong/Moderate/Weak)
- ปัจจัยที่อาจเปลี่ยน bias

<<<LIQUIDITY_MAP>>>
วิเคราะห์โซนสภาพคล่อง:
- Buy-side liquidity: โซนที่ stop loss ของ short จะถูก sweep
- Sell-side liquidity: โซนที่ stop loss ของ long จะถูก sweep
- Fair Value Gaps (FVG) หรือ imbalance zones
- โซนที่ smart money น่าจะเข้า/ออก
- Order blocks ที่สำคัญ

<<<SETUP>>>
ระบุ trading setup ที่เหมาะสม:
- Setup ที่เหมาะสมตาม playbooks ของผู้ใช้ (ถ้ามี)
- Entry criteria ที่ต้องรอ
- Confirmation signals ที่ต้องเห็น
- สิ่งที่ invalidate setup
- Timeframe ที่แนะนำ

<<<SCENARIO>>>
วิเคราะห์สถานการณ์ที่เป็นไปได้:
- 🟢 Bullish Scenario: เงื่อนไข, เป้าหมาย, ความน่าจะเป็น (%)
- 🔴 Bearish Scenario: เงื่อนไข, เป้าหมาย, ความน่าจะเป็น (%)
- 🟡 Neutral/Range Scenario: หากตลาด sideways
- ปัจจัยที่จะยืนยันแต่ละ scenario

<<<KEY_LEVELS>>>
ระดับราคาสำคัญ (แสดงเป็นตาราง):
| ระดับ | ราคา | ประเภท | เหตุผล |
แนวต้าน (Resistance) อย่างน้อย 3 ระดับ
แนวรับ (Support) อย่างน้อย 3 ระดับ
Pivot points, structural levels, psychological levels
เปรียบเทียบกับ key_levels ที่ผู้ใช้บันทึกไว้ใน journal (ถ้ามี)

<<<TRADE_PLAN>>>
แผนการเทรดที่นำไปปฏิบัติได้:
- ทิศทางที่แนะนำ (Long/Short/Wait)
- Entry zone (ช่วงราคาที่เข้า)
- Stop Loss level พร้อมเหตุผล
- Take Profit targets (TP1, TP2, TP3) พร้อมเหตุผล
- Position sizing แนะนำ (% of account)
- Risk/Reward ratio
- เงื่อนไขที่ต้องยกเลิกแผน (invalidation)
- เวลาที่ควรระวัง (ข่าว, session overlap)

หมายเหตุ:
- เมื่อเอ่ยถึงระดับราคา ให้ระบุตัวเลขชัดเจนเสมอ
- วิเคราะห์ตามหลัก ICT/Smart Money Concepts
- เปรียบเทียบกับ market_bias และ key_levels ที่ผู้ใช้บันทึกไว้ใน journal
- ใช้ข้อมูลข่าวประกอบการวิเคราะห์
- กระชับแต่ครอบคลุม ใช้ตัวเลขประกอบ`;
}

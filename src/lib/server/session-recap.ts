import { getTradeSession } from '$lib/portfolio';

interface RecapTrade {
	id: string;
	symbol: string;
	type: string;
	lot_size: number;
	profit: number | null;
	pips: number | null;
	close_time: string;
}

const sessionLabels: Record<string, string> = {
	asian: 'เซสชัน Asian (00:00–08:00 UTC)',
	london: 'เซสชัน London (08:00–15:00 UTC)',
	newyork: 'เซสชัน New York (15:00–24:00 UTC)'
};

/** Generate session recap HTML from trades for a given date */
export function generateSessionRecapHtml(trades: RecapTrade[], date: string): { title: string; html: string } {
	const sessionMap = new Map<string, RecapTrade[]>();
	for (const trade of trades) {
		const session = getTradeSession(trade.close_time);
		const list = sessionMap.get(session) || [];
		list.push(trade);
		sessionMap.set(session, list);
	}

	const totalProfit = trades.reduce((s, t) => s + Number(t.profit || 0), 0);
	const totalWins = trades.filter(t => Number(t.profit || 0) > 0).length;
	const winRate = trades.length > 0 ? ((totalWins / trades.length) * 100).toFixed(1) : '0';

	let html = `<h1>สรุปเซสชัน — ${date}</h1>`;
	html += `<p><strong>รวม:</strong> ${trades.length} เทรด | P&L: $${totalProfit.toFixed(2)} | Win Rate: ${winRate}%</p>`;
	html += `<hr>`;

	for (const sessionKey of ['asian', 'london', 'newyork'] as const) {
		const sessionTrades = sessionMap.get(sessionKey);
		if (!sessionTrades || sessionTrades.length === 0) {
			html += `<h2>${sessionLabels[sessionKey]}</h2>`;
			html += `<p><em>ไม่มีเทรด</em></p>`;
			continue;
		}

		const sessionProfit = sessionTrades.reduce((s, t) => s + Number(t.profit || 0), 0);
		const sessionWins = sessionTrades.filter(t => Number(t.profit || 0) > 0).length;
		const sessionWinRate = ((sessionWins / sessionTrades.length) * 100).toFixed(1);

		html += `<h2>${sessionLabels[sessionKey]}</h2>`;
		html += `<p><strong>${sessionTrades.length}</strong> เทรด | P&L: <strong>$${sessionProfit.toFixed(2)}</strong> | Win Rate: ${sessionWinRate}%</p>`;
		html += `<ul>`;
		for (const t of sessionTrades) {
			const closeTimeStr = t.close_time ? new Date(t.close_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }) + ' UTC' : '';
			html += `<li><strong>${t.symbol}</strong> ${t.type} ${t.lot_size} lots — P&L: $${Number(t.profit || 0).toFixed(2)} ${t.pips != null ? `(${Number(t.pips).toFixed(1)} pips)` : ''} @ ${closeTimeStr}</li>`;
		}
		html += `</ul>`;
	}

	return { title: `สรุปเซสชัน — ${date}`, html };
}

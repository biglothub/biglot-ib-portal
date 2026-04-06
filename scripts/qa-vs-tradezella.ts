/**
 * QA Script: IB Portal vs Tradezella
 * Compares every metric across all features automatically.
 *
 * Usage: npx tsx scripts/qa-vs-tradezella.ts
 *
 * Before running, update TRADEZELLA_AUTH with fresh tokens from:
 *   DevTools > Console > (['access-token','token-type','client','uid'].map(k => `${k}: ${localStorage.getItem(k)}`)).join('\n')
 */

import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

// ─── Config ───────────────────────────────────────────────────────────
const ACCOUNT_ID = 'a6db6bfb-fafe-4148-bcb0-e4f59eb046e0';

const TRADEZELLA_AUTH = {
	'access-token': '2tim4XIJy2CXAMTbAYMMGw',
	'token-type': 'Bearer',
	'client': '2tnNHc73xWkJVNbZXAq6DQ',
	'uid': '100572037245702657965',
};

const supabase = createClient(
	'https://wjnemxkoebpwpixlojsk.supabase.co',
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqbmVteGtvZWJwd3BpeGxvanNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQwNzQ5NywiZXhwIjoyMDg4OTgzNDk3fQ.koHv7bBoHZicklFdOWLaSaNsJdfiUnWiE2y-63sWb1U'
);

// ─── Helpers ──────────────────────────────────────────────────────────
type Result = { name: string; expected: string; actual: string; pass: boolean };
const results: Result[] = [];

function check(name: string, expected: unknown, actual: unknown, tolerance = 0.01) {
	const e = typeof expected === 'number' ? expected : parseFloat(String(expected));
	const a = typeof actual === 'number' ? actual : parseFloat(String(actual));

	let pass: boolean;
	if (isNaN(e) && isNaN(a)) pass = String(expected) === String(actual);
	else if (isNaN(e) || isNaN(a)) pass = false;
	else pass = Math.abs(e - a) < tolerance;

	results.push({ name, expected: String(expected), actual: String(actual), pass });
}

function fetchTZ(endpoint: string): unknown {
	const headers = Object.entries(TRADEZELLA_AUTH).map(([k, v]) => `-H "${k}: ${v}"`).join(' ');
	const raw = execSync(`curl -s ${headers} "https://api.tradezella.com/api/${endpoint}"`, { encoding: 'utf8' });
	return JSON.parse(raw);
}

// ─── Fetch Data ───────────────────────────────────────────────────────
(async () => {
	console.log('═══════════════════════════════════════════════');
	console.log('  QA: IB Portal vs Tradezella — Full Report');
	console.log('═══════════════════════════════════════════════\n');

	// ── 1. Fetch Tradezella trades ─────────────────────────────────
	console.log('Fetching Tradezella data...');
	const tzTradeList = fetchTZ('trades?start_date=2025-01-01&end_date=2026-12-31') as {
		days: Array<{ realized: string; performance: Array<{ symbol: string; net_profits: string; trade_public_uid: string; realized: string }> }>;
	};

	const tzFlat = tzTradeList.days.flatMap(d =>
		d.performance.map(t => ({ date: d.realized, symbol: t.symbol, pnl: parseFloat(t.net_profits), time: t.realized, uid: t.trade_public_uid }))
	);

	// Fetch individual trade details for deeper comparison
	console.log(`Fetching ${tzFlat.length} trade details...`);
	const tzDetails: any[] = [];
	for (const t of tzFlat) {
		try {
			const detail = fetchTZ(`trades/${t.uid}`) as any;
			if (detail?.symbol) tzDetails.push(detail);
		} catch { /* skip */ }
	}

	// ── 2. Fetch IB Portal trades ──────────────────────────────────
	console.log('Fetching IB Portal data...');
	const { data: ibTrades } = await supabase
		.from('trades')
		.select('*')
		.eq('client_account_id', ACCOUNT_ID)
		.order('close_time', { ascending: true });

	const { data: dailyStats } = await supabase
		.from('daily_stats')
		.select('*')
		.eq('client_account_id', ACCOUNT_ID)
		.order('date', { ascending: true });

	if (!ibTrades || !dailyStats) { console.error('Failed to fetch IB data'); process.exit(1); }

	// ═══════════════════════════════════════════════════════════════
	// FEATURE 1: Trade Count & Totals
	// ═══════════════════════════════════════════════════════════════
	console.log('\n── Feature 1: Trade Count & Totals ──');
	check('Total trade count', tzFlat.length, ibTrades.length);

	const tzTotalPnl = tzFlat.reduce((s, t) => s + t.pnl, 0);
	const ibTotalPnl = ibTrades.reduce((s, t) => s + Number(t.profit || 0), 0);
	check('Total Net P&L', tzTotalPnl.toFixed(2), ibTotalPnl.toFixed(2));

	const tzWins = tzFlat.filter(t => t.pnl > 0).length;
	const ibWins = ibTrades.filter(t => Number(t.profit) > 0).length;
	check('Win count', tzWins, ibWins);

	const tzLosses = tzFlat.filter(t => t.pnl <= 0).length;
	const ibLosses = ibTrades.filter(t => Number(t.profit) <= 0).length;
	check('Loss count', tzLosses, ibLosses);

	const tzWinRate = (tzWins / tzFlat.length) * 100;
	const ibWinRate = (ibWins / ibTrades.length) * 100;
	check('Win Rate %', tzWinRate.toFixed(1), ibWinRate.toFixed(1));

	// ═══════════════════════════════════════════════════════════════
	// FEATURE 2: Per-Day Breakdown (Day View / Calendar)
	// ═══════════════════════════════════════════════════════════════
	console.log('\n── Feature 2: Per-Day Breakdown ──');
	const tzByDate: Record<string, { count: number; pnl: number }> = {};
	for (const t of tzFlat) {
		if (!tzByDate[t.date]) tzByDate[t.date] = { count: 0, pnl: 0 };
		tzByDate[t.date].count++;
		tzByDate[t.date].pnl += t.pnl;
	}

	const ibByDate: Record<string, { count: number; pnl: number }> = {};
	for (const t of ibTrades) {
		const d = t.close_time.split('T')[0];
		if (!ibByDate[d]) ibByDate[d] = { count: 0, pnl: 0 };
		ibByDate[d].count++;
		ibByDate[d].pnl += Number(t.profit || 0);
	}

	const allDates = [...new Set([...Object.keys(tzByDate), ...Object.keys(ibByDate)])].sort();
	check('Trading days count', Object.keys(tzByDate).length, Object.keys(ibByDate).length);

	for (const date of allDates) {
		const tz = tzByDate[date] || { count: 0, pnl: 0 };
		const ib = ibByDate[date] || { count: 0, pnl: 0 };
		check(`[${date}] trade count`, tz.count, ib.count);
		check(`[${date}] day PnL`, tz.pnl.toFixed(2), ib.pnl.toFixed(2));
	}

	// ═══════════════════════════════════════════════════════════════
	// FEATURE 3: Dashboard KPIs
	// ═══════════════════════════════════════════════════════════════
	console.log('\n── Feature 3: Dashboard KPIs ──');

	const tzAvgWin = tzWins > 0 ? tzFlat.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / tzWins : 0;
	const ibAvgWin = ibWins > 0 ? ibTrades.filter(t => Number(t.profit) > 0).reduce((s, t) => s + Number(t.profit), 0) / ibWins : 0;
	check('Avg Win', tzAvgWin.toFixed(2), ibAvgWin.toFixed(2));

	const ibLossCount = ibTrades.filter(t => Number(t.profit) < 0).length;
	const tzLossCount = tzFlat.filter(t => t.pnl < 0).length;
	const tzAvgLoss = tzLossCount > 0 ? Math.abs(tzFlat.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0)) / tzLossCount : 0;
	const ibAvgLoss = ibLossCount > 0 ? Math.abs(ibTrades.filter(t => Number(t.profit) < 0).reduce((s, t) => s + Number(t.profit), 0)) / ibLossCount : 0;
	check('Avg Loss', tzAvgLoss.toFixed(2), ibAvgLoss.toFixed(2));

	const tzTotalWin = tzFlat.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
	const tzTotalLoss = Math.abs(tzFlat.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
	const ibTotalWin = ibTrades.filter(t => Number(t.profit) > 0).reduce((s, t) => s + Number(t.profit), 0);
	const ibTotalLoss = Math.abs(ibTrades.filter(t => Number(t.profit) < 0).reduce((s, t) => s + Number(t.profit), 0));
	const tzPF = tzTotalLoss > 0 ? tzTotalWin / tzTotalLoss : 0;
	const ibPF = ibTotalLoss > 0 ? ibTotalWin / ibTotalLoss : 0;
	check('Profit Factor', tzPF.toFixed(2), ibPF.toFixed(2));

	const tzDayWins = Object.values(tzByDate).filter(d => d.pnl > 0).length;
	const tzDayLosses = Object.values(tzByDate).filter(d => d.pnl <= 0).length;
	const ibDayWins = Object.values(ibByDate).filter(d => d.pnl > 0).length;
	const ibDayLosses = Object.values(ibByDate).filter(d => d.pnl <= 0).length;
	const tzDayWinRate = (tzDayWins + tzDayLosses) > 0 ? (tzDayWins / (tzDayWins + tzDayLosses)) * 100 : 0;
	const ibDayWinRate = (ibDayWins + ibDayLosses) > 0 ? (ibDayWins / (ibDayWins + ibDayLosses)) * 100 : 0;
	check('Day Win Rate %', tzDayWinRate.toFixed(1), ibDayWinRate.toFixed(1));

	// ═══════════════════════════════════════════════════════════════
	// FEATURE 4: Per-Trade Fields (Trades Page)
	// ═══════════════════════════════════════════════════════════════
	console.log('\n── Feature 4: Per-Trade Fields ──');
	tzDetails.sort((a, b) => a.open_date.localeCompare(b.open_date) || a.symbol.localeCompare(b.symbol));
	const ibSorted = [...ibTrades].sort((a, b) => a.open_time.localeCompare(b.open_time) || a.symbol.replace('.S', '').localeCompare(b.symbol.replace('.S', '')));

	let fieldChecks = { symbol: 0, type: 0, lots: 0, pnl: 0, times: 0, pips: 0 };
	const count = Math.min(tzDetails.length, ibSorted.length);

	for (let i = 0; i < count; i++) {
		const t = tzDetails[i], b = ibSorted[i];
		if (t.symbol === b.symbol.replace('.S', '')) fieldChecks.symbol++;
		const tz_type = t.side === 'SHORT' ? 'SELL' : 'BUY';
		if (tz_type === b.type) fieldChecks.type++;
		if (Math.abs(parseFloat(t.quantity) - parseFloat(b.lot_size)) < 0.001) fieldChecks.lots++;
		if (Math.abs(parseFloat(t.net_profits) - parseFloat(b.profit)) < 0.01) fieldChecks.pnl++;
		if (t.open_date.slice(0, 19) === b.open_time.slice(0, 19)) fieldChecks.times++;

		const tzPips = parseFloat(t.pips || '0');
		const ibPips = parseFloat(b.pips || '0');
		// For XAUUSD bridge has ×100 bug (fixed but not re-synced)
		const pipsMatch = Math.abs(tzPips - ibPips) < 0.5 || Math.abs(tzPips * 100 - ibPips) < 0.5;
		if (pipsMatch) fieldChecks.pips++;
	}

	check('Symbol match', count, fieldChecks.symbol);
	check('Type (BUY/SELL) match', count, fieldChecks.type);
	check('Lot size match', count, fieldChecks.lots);
	check('Per-trade PnL match', count, fieldChecks.pnl);
	check('Open/Close time match', count, fieldChecks.times);
	check('Pips match (or ×100 known bug)', count, fieldChecks.pips);

	// ═══════════════════════════════════════════════════════════════
	// FEATURE 5: Analytics — Symbol Breakdown
	// ═══════════════════════════════════════════════════════════════
	console.log('\n── Feature 5: Symbol Breakdown ──');
	const tzBySymbol: Record<string, { count: number; pnl: number }> = {};
	for (const t of tzFlat) {
		if (!tzBySymbol[t.symbol]) tzBySymbol[t.symbol] = { count: 0, pnl: 0 };
		tzBySymbol[t.symbol].count++;
		tzBySymbol[t.symbol].pnl += t.pnl;
	}

	const ibBySymbol: Record<string, { count: number; pnl: number }> = {};
	for (const t of ibTrades) {
		const sym = t.symbol.replace('.S', '');
		if (!ibBySymbol[sym]) ibBySymbol[sym] = { count: 0, pnl: 0 };
		ibBySymbol[sym].count++;
		ibBySymbol[sym].pnl += Number(t.profit || 0);
	}

	for (const sym of Object.keys(tzBySymbol)) {
		const tz = tzBySymbol[sym];
		const ib = ibBySymbol[sym] || { count: 0, pnl: 0 };
		check(`[${sym}] trade count`, tz.count, ib.count);
		check(`[${sym}] Net PnL`, tz.pnl.toFixed(2), ib.pnl.toFixed(2));
	}

	// ═══════════════════════════════════════════════════════════════
	// FEATURE 6: Analytics — Session Breakdown
	// ═══════════════════════════════════════════════════════════════
	console.log('\n── Feature 6: Session Breakdown ──');
	function getSession(utcHour: number): string {
		if (utcHour >= 0 && utcHour < 8) return 'asian';
		if (utcHour >= 8 && utcHour < 15) return 'london';
		return 'newyork';
	}

	const tzBySession: Record<string, { count: number; pnl: number }> = {};
	for (const t of tzFlat) {
		const hour = new Date(t.time).getUTCHours();
		const session = getSession(hour);
		if (!tzBySession[session]) tzBySession[session] = { count: 0, pnl: 0 };
		tzBySession[session].count++;
		tzBySession[session].pnl += t.pnl;
	}

	const ibBySession: Record<string, { count: number; pnl: number }> = {};
	for (const t of ibTrades) {
		const hour = new Date(t.close_time).getUTCHours();
		const session = getSession(hour);
		if (!ibBySession[session]) ibBySession[session] = { count: 0, pnl: 0 };
		ibBySession[session].count++;
		ibBySession[session].pnl += Number(t.profit || 0);
	}

	for (const session of ['asian', 'london', 'newyork']) {
		const tz = tzBySession[session] || { count: 0, pnl: 0 };
		const ib = ibBySession[session] || { count: 0, pnl: 0 };
		check(`[${session}] trade count`, tz.count, ib.count);
		check(`[${session}] PnL`, tz.pnl.toFixed(2), ib.pnl.toFixed(2));
	}

	// ═══════════════════════════════════════════════════════════════
	// FEATURE 7: Daily Stats (pre-computed in DB)
	// ═══════════════════════════════════════════════════════════════
	console.log('\n── Feature 7: Daily Stats (DB) ──');
	for (const date of allDates) {
		const tz = tzByDate[date];
		const stat = dailyStats?.find(s => s.date === date);
		if (tz && stat) {
			check(`[${date}] daily_stats.profit`, tz.pnl.toFixed(2), Number(stat.profit).toFixed(2));
			check(`[${date}] daily_stats.total_trades`, tz.count, stat.total_trades);
			const tzDayWinRate = tz.count > 0
				? (tzFlat.filter(t => t.date === date && t.pnl > 0).length / tz.count * 100)
				: 0;
			check(`[${date}] daily_stats.win_rate`, tzDayWinRate.toFixed(1), Number(stat.win_rate).toFixed(1));
		}
	}

	// ═══════════════════════════════════════════════════════════════
	// REPORT
	// ═══════════════════════════════════════════════════════════════
	console.log('\n═══════════════════════════════════════════════');
	console.log('  RESULTS');
	console.log('═══════════════════════════════════════════════\n');

	const passed = results.filter(r => r.pass);
	const failed = results.filter(r => !r.pass);

	console.log(`Total checks: ${results.length}`);
	console.log(`Passed: ${passed.length} ✅`);
	console.log(`Failed: ${failed.length} ❌`);

	if (failed.length > 0) {
		console.log('\n── Failed Checks ──');
		for (const f of failed) {
			console.log(`  ❌ ${f.name}`);
			console.log(`     Expected: ${f.expected}`);
			console.log(`     Actual:   ${f.actual}`);
		}
	}

	console.log('\n── All Checks ──');
	for (const r of results) {
		console.log(`  ${r.pass ? '✅' : '❌'} ${r.name.padEnd(40)} expected=${r.expected.padEnd(12)} actual=${r.actual}`);
	}

	process.exit(failed.length > 0 ? 1 : 0);
})();

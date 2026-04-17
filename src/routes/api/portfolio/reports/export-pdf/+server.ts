import { getTradeDurationMinutes, getTradeReviewStatus, getTradeSession, parsePortfolioFilters } from '$lib/portfolio';
import { buildAnalyticsViewData } from '$lib/server/analytics-export';
import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { fetchPortfolioBaseData } from '$lib/server/portfolio';
import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import type { Trade } from '$lib/types';
import type { RequestHandler } from './$types';

function esc(value: unknown): string {
	return String(value ?? '—')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function fc(value: number): string {
	const sign = value < 0 ? '-' : '+';
	return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function fp(value: number): string {
	return `${value.toFixed(1)}%`;
}

function fr(value: number): string {
	if (!Number.isFinite(value) || value >= 999) return '∞';
	return value.toFixed(2);
}

function fl(values: Array<string | number | null | undefined>, fallback = 'All'): string {
	const cleaned = values.map((v) => String(v ?? '').trim()).filter(Boolean);
	return cleaned.length > 0 ? cleaned.join(', ') : fallback;
}

function row2(label: string, value: string): string {
	return `<tr><td class="label">${esc(label)}</td><td>${esc(value)}</td></tr>`;
}

function metricCard(label: string, value: string, color = ''): string {
	return `<div class="metric-card"><div class="metric-label">${esc(label)}</div><div class="metric-value${color ? ` ${color}` : ''}">${esc(value)}</div></div>`;
}

function tableSection(title: string, headers: string[], rows: string[][]): string {
	if (rows.length === 0) {
		return `<section><h2>${esc(title)}</h2><p class="empty">ไม่มีข้อมูล</p></section>`;
	}
	const thead = `<thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>`;
	const tbody = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
	return `<section><h2>${esc(title)}</h2><div class="table-wrap"><table>${thead}${tbody}</table></div></section>`;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:export-pdf:${profile.id}`, 5, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	const body = await request.json().catch(() => ({}));
	const filterState = parsePortfolioFilters(new URLSearchParams(body.filters || ''));
	const baseData = await fetchPortfolioBaseData(locals.supabase, account.id, profile.id);
	const analyticsView = buildAnalyticsViewData(baseData, filterState);
	const {
		report,
		kpiMetrics,
		statsOverview,
		symbolBreakdown,
		tagBreakdown,
		dayOfWeekReport,
		dayTimeHeatmap,
		riskAnalysis,
		correlationMatrix,
		healthScore,
		dailyHistory
	} = analyticsView;

	const generatedAt = new Date().toLocaleString('th-TH', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});

	const activeFilters: Array<{ label: string; value: string }> = [
		{ label: 'ช่วงวันที่', value: filterState.from || filterState.to ? `${filterState.from || '...'} ถึง ${filterState.to || '...'}` : 'ทั้งหมด' },
		{ label: 'สัญลักษณ์', value: fl(filterState.symbols) },
		{ label: 'Session', value: fl(filterState.sessions) },
		{ label: 'ทิศทาง', value: fl(filterState.directions) },
		{ label: 'สถานะ Review', value: fl(filterState.reviewStatus) },
		{ label: 'ผลลัพธ์', value: filterState.outcome || 'ทั้งหมด' },
		{ label: 'Tags', value: fl(filterState.tagIds) },
		{ label: 'Playbook', value: fl(filterState.playbookIds) }
	];

	const bestHeatSlot = [...dayTimeHeatmap.cells].sort((a, b) => b.pnl - a.pnl)[0];
	const worstHeatSlot = [...dayTimeHeatmap.cells].sort((a, b) => a.pnl - b.pnl)[0];

	const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>Analytics Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Sarabun', 'Noto Sans Thai', 'TH Sarabun New', Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    background: #fff;
    padding: 20px 28px;
  }
  h1 { font-size: 20pt; font-weight: 700; margin-bottom: 2px; }
  h2 { font-size: 12pt; font-weight: 700; margin: 18px 0 8px; color: #111; border-bottom: 1.5px solid #e5e7eb; padding-bottom: 4px; }
  .subtitle { font-size: 9pt; color: #6b7280; margin-bottom: 12px; }
  section { margin-bottom: 4px; }
  .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 4px; }
  .metric-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; background: #f9fafb; }
  .metric-label { font-size: 8pt; color: #6b7280; margin-bottom: 2px; }
  .metric-value { font-size: 13pt; font-weight: 700; color: #111; }
  .metric-value.pos { color: #16a34a; }
  .metric-value.neg { color: #dc2626; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .info-table td { padding: 3px 6px; font-size: 9.5pt; vertical-align: top; }
  .info-table .label { font-weight: 600; color: #374151; width: 38%; }
  .table-wrap { overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  thead tr { background: #1f2937; color: #fff; }
  thead th { padding: 5px 6px; text-align: left; font-weight: 600; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; }
  .empty { color: #9ca3af; font-size: 9pt; padding: 4px 0; }
  .footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 8pt; color: #9ca3af; display: flex; justify-content: space-between; }
  @media print {
    body { padding: 10px 16px; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    section { page-break-inside: avoid; }
  }
  @page { size: A4 portrait; margin: 12mm 14mm; }
</style>
</head>
<body>

<h1>Portfolio Analytics Report</h1>
<div class="subtitle">สร้างเมื่อ ${esc(generatedAt)} · MT5 ${esc(account.mt5_account_id)} @ ${esc(account.mt5_server)}</div>

<section>
<h2>ตัวกรองที่ใช้</h2>
<table class="info-table">
${activeFilters.map((f) => row2(f.label, f.value)).join('\n')}
</table>
</section>

<section>
<h2>สรุปผลการเทรด</h2>
<div class="metric-grid">
  ${metricCard('จำนวนเทรด', String(kpiMetrics.totalTrades))}
  ${metricCard('วันที่เทรด', String(kpiMetrics.totalTradingDays))}
  ${metricCard('Net P&L', fc(kpiMetrics.netPnl), kpiMetrics.netPnl >= 0 ? 'pos' : 'neg')}
  ${metricCard('Win Rate (เทรด)', fp(kpiMetrics.tradeWinRate))}
  ${metricCard('Win Rate (วัน)', fp(kpiMetrics.dayWinRate))}
  ${metricCard('Profit Factor', fr(kpiMetrics.profitFactor))}
  ${metricCard('Expectancy', fc(report.expectancy))}
  ${metricCard('Avg Win', fc(kpiMetrics.avgWin))}
  ${metricCard('Avg Loss', fc(-kpiMetrics.avgLoss))}
  ${metricCard('Recovery Factor', fr(kpiMetrics.recoveryFactor || 0))}
  ${metricCard('Max DD %', fp(kpiMetrics.maxDrawdownPct || 0))}
  ${metricCard('Health Score', healthScore.noData ? 'N/A' : String(healthScore.score))}
</div>
</section>

<section>
<h2>วินัยและการทบทวน</h2>
<table class="info-table">
${row2('Journal completion rate', fp(report.journalSummary.completionRate))}
${row2('Journal streak', `${report.journalSummary.currentStreak} วัน`)}
${row2('Journal ล่าสุด', report.journalSummary.lastCompletedDate || '—')}
${row2('Rule breaks ทั้งหมด', String(report.ruleBreakMetrics.totalRuleBreaks))}
${row2('ขาดทุนจาก rule breaks', fc(-report.ruleBreakMetrics.ruleBreakLoss))}
${row2('Mistake patterns', String(report.mistakeStats.length))}
</table>
</section>

${statsOverview.map((section) => `
<section>
<h2>${esc(section.title)}</h2>
<table class="info-table">
${section.rows.map((r) => row2(r.label, r.value)).join('\n')}
</table>
</section>`).join('')}

${tableSection('Setup Performance',
	['Setup', 'เทรด', 'Win %', 'PF', 'Expectancy', 'Net P&L'],
	report.setupPerformance.slice(0, 15).map((item) => [
		item.name,
		String(item.totalTrades),
		fp(item.winRate),
		fr(item.profitFactor),
		fc(item.expectancy),
		fc(item.totalProfit)
	])
)}

${tableSection('Session Performance',
	['Session', 'เทรด', 'Win %', 'กำไร'],
	report.sessionStats.map((item) => [
		item.session,
		String(item.trades),
		fp(item.winRate),
		fc(item.profit)
	])
)}

${tableSection('Duration Buckets',
	['ช่วงเวลา', 'เทรด', 'Avg นาที', 'กำไร'],
	report.durationBuckets.map((item) => [
		item.bucket,
		String(item.count),
		String(item.avgMinutes),
		fc(item.profit)
	])
)}

${tableSection('Rule Breaks',
	['กฎ', 'ครั้ง', 'ชนะ', 'ขาดทุน'],
	report.ruleBreakMetrics.topRules.map((item) => [
		item.rule,
		String(item.count),
		String(item.wins),
		fc(-item.loss)
	])
)}

${tableSection('Mistake Tags',
	['Mistake', 'ครั้ง', 'ต้นทุน'],
	report.mistakeStats.slice(0, 15).map((item) => [
		item.name,
		String(item.count),
		fc(-item.cost)
	])
)}

${tableSection('Symbol Breakdown',
	['Symbol', 'เทรด', 'Win %', 'PF', 'Avg P&L', 'Net P&L'],
	symbolBreakdown.slice(0, 20).map((item) => [
		item.symbol,
		String(item.trades),
		fp(item.winRate),
		fr(item.profitFactor),
		fc(item.avgPnl),
		fc(item.netPnl)
	])
)}

${tableSection('Tag Categories',
	['หมวดหมู่', 'Tags', 'เทรด', 'Win %', 'PF', 'Net P&L'],
	(tagBreakdown?.byCategory || []).map((item) => [
		item.category,
		String(item.tagCount),
		String(item.trades),
		fp(item.winRate),
		fr(item.profitFactor),
		fc(item.netPnl)
	])
)}

${tableSection('Top Tags',
	['Tag', 'หมวด', 'เทรด', 'Win %', 'PF', 'Net P&L'],
	(tagBreakdown?.byTag || []).slice(0, 20).map((item) => [
		item.tagName,
		item.category,
		String(item.trades),
		fp(item.winRate),
		fr(item.profitFactor),
		fc(item.netPnl)
	])
)}

${tableSection('Day Of Week',
	['วัน', 'เทรด', 'Win %', 'PF', 'Avg Hold', 'Net P&L'],
	(dayOfWeekReport?.days || []).map((item) => [
		item.day,
		String(item.trades),
		fp(item.winRate),
		fr(item.profitFactor),
		`${item.avgHoldMinutes}m`,
		fc(item.netPnl)
	])
)}

<section>
<h2>Heatmap Highlights</h2>
<table class="info-table">
${row2('ช่วงเวลาดีที่สุด', bestHeatSlot ? `วัน ${bestHeatSlot.day} เวลา ${bestHeatSlot.hour}:00 | ${fc(bestHeatSlot.pnl)} | ${bestHeatSlot.trades} เทรด` : '—')}
${row2('ช่วงเวลาแย่ที่สุด', worstHeatSlot ? `วัน ${worstHeatSlot.day} เวลา ${worstHeatSlot.hour}:00 | ${fc(worstHeatSlot.pnl)} | ${worstHeatSlot.trades} เทรด` : '—')}
</table>
</section>

<section>
<h2>Risk Analysis</h2>
<table class="info-table">
${row2('Max drawdown', fc(-riskAnalysis.maxDrawdown))}
${row2('Max drawdown date', riskAnalysis.maxDrawdownDate || '—')}
${row2('Average drawdown', fc(-riskAnalysis.avgDrawdown))}
${row2('Largest win', fc(riskAnalysis.largestWin))}
${row2('Largest loss', fc(riskAnalysis.largestLoss))}
${row2('Max loss streak', String(riskAnalysis.maxLossStreak))}
${row2('Daily P&L stdev', fc(riskAnalysis.dailyStdDev))}
${row2('Sharpe / Sortino / Calmar', `${fr(riskAnalysis.sharpeRatio)} / ${fr(riskAnalysis.sortinoRatio)} / ${fr(riskAnalysis.calmarRatio)}`)}
</table>
</section>

${tableSection('Top Drawdown Periods',
	['Start', 'Trough', 'Recovery', 'DD', 'DD %', 'วัน'],
	riskAnalysis.topDrawdowns.map((item) => [
		item.startDate,
		item.troughDate,
		item.recoveryDate || 'open',
		fc(-item.maxDrawdown),
		fp(item.maxDrawdownPct),
		String(item.durationDays)
	])
)}

${tableSection('R-Multiple Distribution',
	['Bucket', 'เทรด', 'ชนะ', 'แพ้'],
	riskAnalysis.rrDistribution.map((item) => [
		item.label,
		String(item.count),
		String(item.wins),
		String(item.losses)
	])
)}

${tableSection('Correlation Pairs',
	['คู่', 'Correlation', 'Shared Days'],
	correlationMatrix.topPairs.map((item) => [
		`${item.symA} / ${item.symB}`,
		item.correlation.toFixed(2),
		String(item.sharedDays)
	])
)}

${tableSection('Progress Snapshot',
	['เป้าหมาย', 'Target', 'Current', 'Progress %'],
	report.progressSnapshot.map((item) => [
		item.goal_type,
		String(item.target_value),
		String(Math.round(item.currentValue * 100) / 100),
		fp(item.progress)
	])
)}

${tableSection('Daily Performance',
	['วันที่', 'เทรด', 'Reviewed', 'Win %', 'Best', 'Worst', 'P&L'],
	dailyHistory.map((item) => [
		item.date,
		String(item.totalTrades),
		String(item.reviewedTrades),
		fp(item.winRate),
		fc(item.bestTrade),
		fc(item.worstTrade),
		fc(item.profit)
	])
)}

${tableSection('Trade Appendix',
	['วันที่', 'Symbol', 'Side', 'Session', 'Hold', 'P&L', 'Review', 'Tags'],
	report.filteredTrades.map((trade: Trade) => [
		String(trade.close_time || '').split('T')[0],
		trade.symbol,
		trade.type,
		getTradeSession(trade.close_time),
		`${getTradeDurationMinutes(trade.open_time, trade.close_time)}m`,
		fc(Number(trade.profit || 0)),
		getTradeReviewStatus(trade),
		(trade.trade_tag_assignments || [])
			.map((a) => a.trade_tags?.name)
			.filter(Boolean)
			.join(', ')
	])
)}

<div class="footer">
  <span>Analytics export · /portfolio/analytics</span>
  <span>สร้างเมื่อ ${esc(generatedAt)}</span>
</div>

<script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-store'
		}
	});
};

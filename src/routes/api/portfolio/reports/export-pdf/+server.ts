import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { fetchPortfolioBaseData, buildReportExplorer, buildDailyHistory, buildKpiMetrics, buildSymbolBreakdown } from '$lib/server/portfolio';
import { buildStatsOverview } from '$lib/server/stats-overview';
import { parsePortfolioFilters } from '$lib/portfolio';
import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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
	const report = buildReportExplorer(baseData.trades, baseData.dailyStats, baseData.journals, filterState);
	const dailyHistory = buildDailyHistory(report.filteredTrades);
	const kpi = buildKpiMetrics(report.filteredTrades, dailyHistory);
	const symbols = buildSymbolBreakdown(report.filteredTrades);
	const stats = buildStatsOverview(report.filteredTrades, dailyHistory, report.analytics);

	// Generate PDF using jsPDF
	const { jsPDF } = await import('jspdf');
	const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

	const pageWidth = 210;
	const margin = 15;
	const contentWidth = pageWidth - margin * 2;
	let y = margin;

	// Helper functions
	const addText = (text: string, x: number, yPos: number, opts: { size?: number; color?: string; font?: string; align?: string } = {}) => {
		doc.setFontSize(opts.size || 10);
		doc.setTextColor(opts.color || '#333333');
		if (opts.font === 'bold') doc.setFont('helvetica', 'bold');
		else doc.setFont('helvetica', 'normal');
		doc.text(text, x, yPos, { align: (opts.align as any) || 'left' });
	};

	const addLine = (y1: number) => {
		doc.setDrawColor('#CCCCCC');
		doc.setLineWidth(0.3);
		doc.line(margin, y1, pageWidth - margin, y1);
	};

	// === HEADER ===
	addText('Trading Performance Report', margin, y, { size: 18, font: 'bold', color: '#1a1a1a' });
	y += 8;
	addText(`MT5: ${account.mt5_account_id} @ ${account.mt5_server}`, margin, y, { size: 9, color: '#666666' });
	addText(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - margin, y, { size: 9, color: '#666666', align: 'right' });
	y += 4;
	addLine(y);
	y += 8;

	// === KPI GRID (2x4) ===
	addText('Key Metrics', margin, y, { size: 12, font: 'bold' });
	y += 6;

	const kpiItems = [
		{ label: 'Net P&L', value: `$${kpi.netPnl.toFixed(2)}` },
		{ label: 'Win Rate', value: `${kpi.tradeWinRate.toFixed(1)}%` },
		{ label: 'Profit Factor', value: kpi.profitFactor >= 999 ? '∞' : kpi.profitFactor.toFixed(2) },
		{ label: 'Day Win Rate', value: `${kpi.dayWinRate.toFixed(1)}%` },
		{ label: 'Total Trades', value: String(kpi.totalTrades) },
		{ label: 'Avg Win', value: `$${kpi.avgWin.toFixed(2)}` },
		{ label: 'Avg Loss', value: `-$${kpi.avgLoss.toFixed(2)}` },
		{ label: 'Expectancy', value: `$${(kpi.totalTrades > 0 ? kpi.netPnl / kpi.totalTrades : 0).toFixed(2)}` },
	];

	const colWidth = contentWidth / 4;
	kpiItems.forEach((item, i) => {
		const col = i % 4;
		const row = Math.floor(i / 4);
		const x = margin + col * colWidth;
		const yRow = y + row * 12;
		addText(item.label, x, yRow, { size: 8, color: '#888888' });
		addText(item.value, x, yRow + 5, { size: 11, font: 'bold' });
	});

	y += 30;
	addLine(y);
	y += 8;

	// === STATS SUMMARY (top rows from each section) ===
	addText('Performance Summary', margin, y, { size: 12, font: 'bold' });
	y += 6;

	for (const section of stats) {
		if (y > 260) { doc.addPage(); y = margin; }
		addText(section.title, margin, y, { size: 9, font: 'bold', color: '#555555' });
		y += 5;

		for (const row of section.rows.slice(0, 8)) { // limit rows per section
			if (y > 275) { doc.addPage(); y = margin; }
			addText(row.label, margin + 2, y, { size: 8, color: '#666666' });
			addText(row.value, pageWidth - margin, y, { size: 8, font: 'bold', align: 'right' });
			y += 4.5;
		}
		y += 3;
	}

	y += 2;
	addLine(y);
	y += 8;

	// === SYMBOL BREAKDOWN (top 10) ===
	if (symbols.length > 0) {
		if (y > 240) { doc.addPage(); y = margin; }
		addText('Symbol Performance', margin, y, { size: 12, font: 'bold' });
		y += 6;

		// Table header
		const cols = [margin, margin + 30, margin + 55, margin + 80, margin + 105, margin + 140];
		addText('Symbol', cols[0], y, { size: 8, font: 'bold', color: '#888888' });
		addText('Trades', cols[1], y, { size: 8, font: 'bold', color: '#888888' });
		addText('Win Rate', cols[2], y, { size: 8, font: 'bold', color: '#888888' });
		addText('PF', cols[3], y, { size: 8, font: 'bold', color: '#888888' });
		addText('Net P&L', cols[4], y, { size: 8, font: 'bold', color: '#888888' });
		y += 4;
		addLine(y);
		y += 3;

		for (const sym of symbols.slice(0, 10)) {
			if (y > 275) { doc.addPage(); y = margin; }
			addText(sym.symbol, cols[0], y, { size: 8 });
			addText(String(sym.trades), cols[1], y, { size: 8 });
			addText(`${sym.winRate.toFixed(0)}%`, cols[2], y, { size: 8 });
			addText(sym.profitFactor === Infinity ? '∞' : sym.profitFactor.toFixed(2), cols[3], y, { size: 8 });
			addText(`$${sym.netPnl.toFixed(2)}`, cols[4], y, { size: 8, color: sym.netPnl >= 0 ? '#16a34a' : '#dc2626' });
			y += 4.5;
		}
	}

	// === FOOTER ===
	const totalPages = doc.getNumberOfPages();
	for (let i = 1; i <= totalPages; i++) {
		doc.setPage(i);
		addText('Generated by IB-Portal', margin, 290, { size: 7, color: '#AAAAAA' });
		addText(`Page ${i} of ${totalPages}`, pageWidth - margin, 290, { size: 7, color: '#AAAAAA', align: 'right' });
	}

	// Return PDF as binary
	const pdfOutput = doc.output('arraybuffer');
	return new Response(pdfOutput, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="trading-report-${new Date().toISOString().split('T')[0]}.pdf"`
		}
	});
};

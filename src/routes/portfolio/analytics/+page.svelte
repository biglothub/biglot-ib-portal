<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import AnalyticsDashboard from '$lib/components/portfolio/AnalyticsDashboard.svelte';
	import PortfolioFilterBar from '$lib/components/portfolio/PortfolioFilterBar.svelte';
	import StatsOverviewTable from '$lib/components/reports/StatsOverviewTable.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import HealthScoreCard from '$lib/components/portfolio/HealthScoreCard.svelte';
	import { formatCurrency, formatNumber, formatPercent } from '$lib/utils';

	let { data } = $props();
	let { report, filterState, filterOptions, tags, playbooks, savedViews, symbolBreakdown, tagBreakdown, dayOfWeekReport, dayTimeHeatmap, calendarDays, kpiMetrics, statsOverview, healthScore, riskAnalysis, correlationMatrix } = $derived(data);

	// Sub-tab state from URL
	let activeTab = $derived($page.url.searchParams.get('tab') || 'overview');

	// Lazy-load heavy chart components only when their tab is first activated
	let ConfigurableMetricChart = $state<any>(null);
	$effect(() => {
		if (activeTab === 'performance' && !ConfigurableMetricChart) {
			import('$lib/components/charts/ConfigurableMetricChart.svelte').then(m => {
				ConfigurableMetricChart = m.default;
			});
		}
	});

	const subTabs = [
		{ key: 'overview', label: 'ภาพรวม' },
		{ key: 'performance', label: 'ผลการเทรด' },
		{ key: 'calendar', label: 'ปฏิทิน' },
		{ key: 'symbols', label: 'สัญลักษณ์' },
		{ key: 'tags', label: 'แท็ก' },
		{ key: 'days', label: 'รายวัน' },
		{ key: 'daytime', label: 'วัน & เวลา' },
		{ key: 'risk', label: 'ความเสี่ยง' },
		{ key: 'recaps', label: 'สรุป & Insights' },
		{ key: 'compare', label: 'เปรียบเทียบ' },
		{ key: 'correlation', label: 'ความสัมพันธ์' },
	];

	function switchTab(tab: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('tab', tab);
		goto(`/portfolio/analytics?${params.toString()}`, { keepFocus: true, noScroll: true });
	}

	// Compare state
	let group1Symbol = $state('');
	let group2Symbol = $state('');
	let group1Side = $state('');
	let group2Side = $state('');
	let compareResult = $state<any>(null);

	function generateCompare() {
		if (!report?.filteredTrades) return;
		const trades = report.filteredTrades;

		const filterGroup = (sym: string, side: string) => {
			return trades.filter((t: any) => {
				if (sym && t.symbol !== sym) return false;
				if (side && t.type !== side) return false;
				return true;
			});
		};

		const calcGroupStats = (groupTrades: any[]) => {
			const wins = groupTrades.filter((t: any) => Number(t.profit) > 0);
			const losses = groupTrades.filter((t: any) => Number(t.profit) < 0);
			const totalW = wins.reduce((s: number, t: any) => s + Number(t.profit), 0);
			const totalL = Math.abs(losses.reduce((s: number, t: any) => s + Number(t.profit), 0));
			const netPnl = groupTrades.reduce((s: number, t: any) => s + Number(t.profit), 0);
			return {
				trades: groupTrades.length,
				wins: wins.length,
				losses: losses.length,
				winRate: groupTrades.length > 0 ? (wins.length / groupTrades.length) * 100 : 0,
				profitFactor: totalL > 0 ? totalW / totalL : 0,
				netPnl,
				avgPnl: groupTrades.length > 0 ? netPnl / groupTrades.length : 0,
			};
		};

		const g1 = calcGroupStats(filterGroup(group1Symbol, group1Side));
		const g2 = calcGroupStats(filterGroup(group2Symbol, group2Side));

		compareResult = { group1: g1, group2: g2 };
	}

	// Calendar state
	let calendarYear = $state(new Date().getFullYear());
	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	function getMonthGrid(year: number, month: number) {
		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const grid: Array<{ date: string; day: number; pnl: number; trades: number } | null> = [];
		for (let i = 0; i < firstDay; i++) grid.push(null);
		for (let d = 1; d <= daysInMonth; d++) {
			const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			const dayData = calendarDays?.find((cd: any) => cd.date === dateStr);
			grid.push({ date: dateStr, day: d, pnl: dayData?.pnl || 0, trades: dayData?.trades || 0 });
		}
		return grid;
	}

	function calDayBg(pnl: number, trades: number) {
		if (trades === 0) return '';
		if (pnl > 0) return 'bg-green-500/30 text-green-300';
		if (pnl < 0) return 'bg-red-500/30 text-red-300';
		return 'bg-gray-500/20 text-gray-400';
	}

	// Symbol sort
	let symbolSort = $state<{ key: string; asc: boolean }>({ key: 'netPnl', asc: false });
	const sortedSymbols = $derived((() => {
		const arr = [...(symbolBreakdown || [])];
		arr.sort((a: any, b: any) => {
			const va = a[symbolSort.key] ?? 0;
			const vb = b[symbolSort.key] ?? 0;
			return symbolSort.asc ? va - vb : vb - va;
		});
		return arr;
	})());

	function toggleSort(key: string) {
		if (symbolSort.key === key) symbolSort = { key, asc: !symbolSort.asc };
		else symbolSort = { key, asc: false };
	}

	// Tag sort + filter
	let tagSort = $state<{ key: string; asc: boolean }>({ key: 'netPnl', asc: false });
	let tagViewMode = $state('all');

	const sortedTags = $derived((() => {
		let arr = [...(tagBreakdown?.byTag || [])];
		if (tagViewMode !== 'all') arr = arr.filter((t: any) => t.category === tagViewMode);
		arr.sort((a: any, b: any) => {
			const va = a[tagSort.key] ?? 0;
			const vb = b[tagSort.key] ?? 0;
			return tagSort.asc ? va - vb : vb - va;
		});
		return arr;
	})());

	function toggleTagSort(key: string) {
		if (tagSort.key === key) tagSort = { key, asc: !tagSort.asc };
		else tagSort = { key, asc: false };
	}

	const categoryLabels: Record<string, string> = {
		setup: 'กลยุทธ์',
		execution: 'การเข้าเทรด',
		emotion: 'อารมณ์',
		mistake: 'ข้อผิดพลาด',
		market_condition: 'สภาพตลาด',
		custom: 'กำหนดเอง'
	};

	const categoryColors: Record<string, string> = {
		setup: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
		execution: 'text-green-400 bg-green-500/10 border-green-500/20',
		emotion: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
		mistake: 'text-red-400 bg-red-500/10 border-red-500/20',
		market_condition: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
		custom: 'text-gray-400 bg-gray-500/10 border-gray-500/20'
	};

	// Day-of-week sort
	let daySort = $state<{ key: string; asc: boolean }>({ key: 'dayIdx', asc: true });
	const sortedDays = $derived((() => {
		const arr = [...(dayOfWeekReport?.days || [])];
		arr.sort((a: any, b: any) => {
			const va = a[daySort.key] ?? 0;
			const vb = b[daySort.key] ?? 0;
			return daySort.asc ? va - vb : vb - va;
		});
		return arr;
	})());

	function toggleDaySort(key: string) {
		if (daySort.key === key) daySort = { key, asc: !daySort.asc };
		else daySort = { key, asc: false };
	}

	function formatHoldTime(minutes: number): string {
		if (minutes < 60) return `${minutes}m`;
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	// Heatmap mode
	let heatmapMode = $state<'trades' | 'pnl' | 'winRate'>('pnl');
	const dayLabelsHeatmap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

	function getHeatmapCell(day: number, hour: number) {
		return dayTimeHeatmap?.cells?.find((c: any) => c.day === day && c.hour === hour) || null;
	}

	function heatmapCellColor(cell: any): string {
		if (!cell || cell.trades === 0) return 'bg-dark-bg/20';
		if (heatmapMode === 'trades') {
			const max = dayTimeHeatmap?.maxTrades || 1;
			const intensity = Math.min(cell.trades / max, 1);
			if (intensity > 0.7) return 'bg-blue-500/70';
			if (intensity > 0.4) return 'bg-blue-500/40';
			return 'bg-blue-500/20';
		}
		if (heatmapMode === 'pnl') {
			const max = dayTimeHeatmap?.maxAbsPnl || 1;
			const intensity = Math.min(Math.abs(cell.pnl) / max, 1);
			if (cell.pnl > 0) {
				if (intensity > 0.6) return 'bg-green-500/60';
				if (intensity > 0.3) return 'bg-green-500/35';
				return 'bg-green-500/15';
			} else {
				if (intensity > 0.6) return 'bg-red-500/60';
				if (intensity > 0.3) return 'bg-red-500/35';
				return 'bg-red-500/15';
			}
		}
		// winRate
		if (cell.winRate >= 70) return 'bg-green-500/60';
		if (cell.winRate >= 50) return 'bg-green-500/30';
		if (cell.winRate >= 30) return 'bg-red-500/30';
		return 'bg-red-500/60';
	}

	// Recaps state
	let recapPeriod = $state<'this_week' | 'last_week' | 'this_month' | 'last_month'>('last_week');
	let recapGenerating = $state(false);
	let recapError = $state('');
	let recapSections = $state<Record<string, { content: string; loading: boolean }>>({
		performance_summary: { content: '', loading: false },
		patterns: { content: '', loading: false },
		mistakes: { content: '', loading: false },
		strengths: { content: '', loading: false },
		action_plan: { content: '', loading: false },
	});
	let recapStats = $state<any>(null);
	let recapPrevStats = $state<any>(null);
	let recapTimestamp = $state('');

	function getRecapPeriodDates(period: string): { start: string; end: string; type: string } {
		const now = new Date();
		const thai = new Date(now.getTime() + 7 * 60 * 60 * 1000); // UTC+7
		const todayStr = thai.toISOString().split('T')[0];
		const today = new Date(todayStr + 'T00:00:00');
		const dayOfWeek = today.getDay();

		if (period === 'this_week') {
			const start = new Date(today); start.setDate(today.getDate() - dayOfWeek);
			return { start: start.toISOString().split('T')[0], end: todayStr, type: 'week' };
		}
		if (period === 'last_week') {
			const end = new Date(today); end.setDate(today.getDate() - dayOfWeek - 1);
			const start = new Date(end); start.setDate(end.getDate() - 6);
			return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], type: 'week' };
		}
		if (period === 'this_month') {
			const start = `${todayStr.substring(0, 7)}-01`;
			return { start, end: todayStr, type: 'month' };
		}
		// last_month
		const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
		const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
		return {
			start: lastMonth.toISOString().split('T')[0],
			end: lastMonthEnd.toISOString().split('T')[0],
			type: 'month'
		};
	}

	async function loadCachedRecap() {
		const { start, type } = getRecapPeriodDates(recapPeriod);
		try {
			const res = await fetch(`/api/portfolio/recaps?period_type=${type}&period_start=${start}`);
			if (res.ok) {
				const { recap } = await res.json();
				if (recap?.sections) {
					const sections = recap.sections as Record<string, string>;
					for (const [key, value] of Object.entries(sections)) {
						if (recapSections[key]) {
							recapSections[key] = { content: value, loading: false };
						}
					}
					recapStats = recap.stats;
					recapTimestamp = new Date(recap.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
					return true;
				}
			}
		} catch { /* ignore */ }
		return false;
	}

	async function generateRecap() {
		recapGenerating = true;
		recapError = '';
		for (const key of Object.keys(recapSections)) {
			recapSections[key] = { content: '', loading: false };
		}
		recapStats = null;
		recapPrevStats = null;

		const { start, end, type } = getRecapPeriodDates(recapPeriod);

		try {
			const res = await fetch('/api/portfolio/recaps', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ period_type: type, period_start: start, period_end: end })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				recapError = res.status === 429
					? 'สรุปบ่อยเกินไป กรุณารอสักครู่ (จำกัด 3 ครั้ง/ชั่วโมง)'
					: data.message || 'เกิดข้อผิดพลาด';
				recapGenerating = false;
				return;
			}

			const reader = res.body?.getReader();
			if (!reader) { recapError = 'ไม่สามารถเชื่อมต่อได้'; recapGenerating = false; return; }

			const decoder = new TextDecoder();
			let buffer = '';
			let currentSection = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const chunk = JSON.parse(line);
						if (chunk.type === 'stats') {
							recapStats = chunk.stats;
							recapPrevStats = chunk.prevStats;
						} else if (chunk.type === 'section_start') {
							currentSection = chunk.section;
							if (recapSections[currentSection]) {
								recapSections[currentSection] = { content: '', loading: true };
							}
						} else if (chunk.type === 'text_delta' && currentSection && recapSections[currentSection]) {
							recapSections[currentSection].content += chunk.text;
						} else if (chunk.type === 'section_end' && recapSections[currentSection]) {
							recapSections[currentSection].loading = false;
						} else if (chunk.type === 'error') {
							recapError = chunk.message || 'AI error';
						}
					} catch { /* skip */ }
				}
			}

			for (const key of Object.keys(recapSections)) {
				if (recapSections[key].loading) recapSections[key].loading = false;
			}
			recapTimestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
		} catch {
			recapError = 'ไม่สามารถเชื่อมต่อได้ ลองอีกครั้ง';
		} finally {
			recapGenerating = false;
		}
	}

	function recapRenderMarkdown(text: string): string {
		let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		html = html.replace(/^### (.+)$/gm, (_, c) => `<h4 class="text-sm font-bold text-white mt-3 mb-1">${c}</h4>`);
		html = html.replace(/^## (.+)$/gm, (_, c) => `<h3 class="text-base font-bold text-white mt-4 mb-2">${c}</h3>`);
		html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
			const items = block.trim().split('\n').map((line: string) => `<li>${line.replace(/^- /, '')}</li>`);
			return `<ul class="list-disc list-inside space-y-1 text-sm text-gray-300">${items.join('')}</ul>`;
		});
		html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
			const items = block.trim().split('\n').map((line: string) => `<li>${line.replace(/^\d+\. /, '')}</li>`);
			return `<ol class="list-decimal list-inside space-y-1 text-sm text-gray-300">${items.join('')}</ol>`;
		});
		html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>');
		html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
		html = html.replace(/\n/g, '<br>');
		html = html.replace(/<br>\s*(<(?:h[2-4]|ul|ol))/g, '$1');
		html = html.replace(/(<\/(?:h[2-4]|ul|ol)>)\s*<br>/g, '$1');
		return html;
	}

	const recapSectionConfig = [
		{ key: 'performance_summary', title: 'สรุปผลการเทรด', icon: '📊' },
		{ key: 'patterns', title: 'รูปแบบที่พบ', icon: '🔍' },
		{ key: 'mistakes', title: 'ข้อผิดพลาด', icon: '⚠️' },
		{ key: 'strengths', title: 'จุดแข็ง', icon: '💪' },
		{ key: 'action_plan', title: 'แผนปรับปรุง', icon: '🎯' },
	];

	const recapPeriodLabels: Record<string, string> = {
		this_week: 'สัปดาห์นี้',
		last_week: 'สัปดาห์ที่แล้ว',
		this_month: 'เดือนนี้',
		last_month: 'เดือนที่แล้ว',
	};

	// Available symbols for compare
	const availableSymbols = $derived([...new Set((report?.filteredTrades || []).map((t: any) => t.symbol))].sort());

	// Correlation matrix helpers
	let hoveredCell = $state<{ i: number; j: number } | null>(null);

	function corrCellBg(val: number | null, isDiag: boolean): string {
		if (isDiag) return 'bg-dark-border/40';
		if (val === null) return 'bg-dark-bg/30';
		const abs = Math.abs(val);
		if (val >= 0) {
			if (abs >= 0.7) return 'bg-red-500/70';
			if (abs >= 0.4) return 'bg-amber-500/50';
			if (abs >= 0.2) return 'bg-amber-500/20';
			return 'bg-dark-bg/30';
		} else {
			if (abs >= 0.7) return 'bg-blue-500/60';
			if (abs >= 0.4) return 'bg-blue-500/35';
			if (abs >= 0.2) return 'bg-blue-500/15';
			return 'bg-dark-bg/30';
		}
	}

	function corrCellText(val: number | null, isDiag: boolean): string {
		if (isDiag) return 'text-gray-500';
		if (val === null) return 'text-gray-600';
		const abs = Math.abs(val);
		if (abs >= 0.4) return 'text-white font-semibold';
		if (abs >= 0.2) return 'text-gray-300';
		return 'text-gray-500';
	}

	function corrLabel(val: number): string {
		const abs = Math.abs(val);
		if (abs >= 0.7) return val >= 0 ? 'สัมพันธ์สูง (+)' : 'สัมพันธ์ตรงข้าม (-)';
		if (abs >= 0.4) return val >= 0 ? 'สัมพันธ์ปานกลาง (+)' : 'สัมพันธ์ตรงข้ามปานกลาง';
		if (abs >= 0.2) return 'สัมพันธ์เล็กน้อย';
		return 'ไม่มีความสัมพันธ์';
	}

	// Export PDF
	let exporting = $state(false);
	async function exportPdf() {
		exporting = true;
		try {
			const res = await fetch('/api/portfolio/reports/export-pdf', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filters: window.location.search })
			});
			if (!res.ok) return;
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `trading-report-${new Date().toISOString().split('T')[0]}.pdf`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			exporting = false;
		}
	}
</script>

<div class="space-y-7">
	<PortfolioFilterBar
		filters={filterState}
		{filterOptions}
		{tags}
		{playbooks}
		{savedViews}
		pageKey="analytics"
	/>

	<!-- Sub-tab navigation + Export -->
	<div class="flex flex-col sm:flex-row sm:items-center gap-2">
		<div class="flex gap-1 bg-dark-surface/60 rounded-xl p-1 overflow-x-auto backdrop-blur-sm border border-dark-border/30 flex-1 min-w-0">
			{#each subTabs as tab}
				<button
					class="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap
						{activeTab === tab.key ? 'bg-dark-bg text-brand-primary shadow-md shadow-brand-primary/5 ring-1 ring-brand-primary/20' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-bg/40'}"
					onclick={() => switchTab(tab.key)}
				>{tab.label}</button>
			{/each}
		</div>
		<button
			onclick={exportPdf}
			disabled={exporting}
			class="flex items-center gap-1.5 rounded-lg border border-dark-border px-3 py-2 text-xs text-gray-400 hover:text-white hover:border-brand-primary/40 transition-colors disabled:opacity-50 whitespace-nowrap"
		>
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
			{exporting ? 'กำลังส่งออก...' : 'ส่งออก PDF'}
		</button>
	</div>

	{#if !report}
		<div class="card">
			<EmptyState message="ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์" />
		</div>

	{:else if activeTab === 'overview'}
		<!-- OVERVIEW (existing analytics) -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="card border-l-2 {report.expectancy >= 0 ? 'border-l-green-500' : 'border-l-red-500'}">
				<div class="text-xs text-gray-500 uppercase tracking-wider">ค่าคาดหวัง</div>
				<div class="mt-1.5 text-2xl font-bold {report.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}">
					{formatCurrency(report.expectancy)}
				</div>
			</div>
			<div class="card border-l-2 border-l-red-500">
				<div class="text-xs text-gray-500 uppercase tracking-wider">ต้นทุนผิดกฎ</div>
				<div class="mt-1.5 text-2xl font-bold text-red-400">{formatCurrency(report.ruleBreakMetrics?.ruleBreakLoss || 0)}</div>
			</div>
			<div class="card border-l-2 border-l-green-500">
				<div class="text-xs text-gray-500 uppercase tracking-wider">บันทึกครบ</div>
				<div class="mt-1.5 text-2xl font-bold text-green-400">{(report.journalSummary?.completionRate || 0).toFixed(0)}%</div>
			</div>
			<div class="card border-l-2 border-l-brand-primary">
				<div class="text-xs text-gray-500 uppercase tracking-wider">เทรดที่กรอง</div>
				<div class="mt-1.5 text-2xl font-bold text-white">{report.filteredTrades?.length || 0}</div>
			</div>
		</div>

		{#if statsOverview && statsOverview.length > 0}
			<div class="card">
				<h2 class="text-base font-semibold text-white mb-4">สถิติของคุณ</h2>
				<StatsOverviewTable sections={statsOverview} />
			</div>
		{/if}

		{#if report.analytics}
			<AnalyticsDashboard analytics={report.analytics} />
		{/if}

		<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
			<div class="card">
				<h2 class="text-sm font-semibold text-gray-300 mb-4">ผลลัพธ์ตาม Setup / Playbook</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-[11px] uppercase tracking-wider">
								<th class="text-left py-2.5 font-medium">กลยุทธ์</th>
								<th class="text-right py-2.5 font-medium">เทรด</th>
								<th class="text-right py-2.5 font-medium">อัตราชนะ</th>
								<th class="text-right py-2.5 font-medium">PF</th>
								<th class="text-right py-2.5 font-medium">ค่าคาดหวัง</th>
								<th class="text-right py-2.5 font-medium">กำไร/ขาดทุน</th>
							</tr>
						</thead>
						<tbody>
							{#each report.setupPerformance || [] as setup}
								<tr class="border-b border-dark-border/30 hover:bg-dark-bg/30 transition-colors">
									<td class="py-2.5 text-white font-medium">{setup.name}</td>
									<td class="py-2.5 text-right text-gray-300">{setup.totalTrades}</td>
									<td class="py-2.5 text-right {setup.winRate >= 50 ? 'text-green-400' : 'text-red-400'}">{formatPercent(setup.winRate).replace('+', '')}</td>
									<td class="py-2.5 text-right {setup.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{setup.profitFactor === Infinity ? '∞' : formatNumber(setup.profitFactor)}</td>
									<td class="py-2.5 text-right {setup.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(setup.expectancy)}</td>
									<td class="py-2.5 text-right font-semibold {setup.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(setup.totalProfit)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="card">
				<h2 class="text-sm font-semibold text-gray-300 mb-4">แยกตามเซสชัน</h2>
				<div class="space-y-3">
					{#each report.sessionStats || [] as session}
						<div class="rounded-xl bg-dark-bg/30 px-4 py-3">
							<div class="flex items-center justify-between">
								<span class="text-white uppercase">{session.session}</span>
								<span class="{session.profit >= 0 ? 'text-green-400' : 'text-red-400'} font-medium">{formatCurrency(session.profit)}</span>
							</div>
							<div class="mt-1 text-xs text-gray-500">{session.trades} เทรด • ชนะ {session.winRate.toFixed(0)}%</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
			<div class="card xl:col-span-1">
				<h2 class="text-sm font-semibold text-gray-300 mb-4">ต้นทุนจากข้อผิดพลาด</h2>
				<div class="space-y-2">
					{#if report.mistakeStats?.length > 0}
						{#each report.mistakeStats.slice(0, 8) as mistake}
							<div class="flex items-center justify-between rounded-xl bg-dark-bg/30 px-3 py-3">
								<div>
									<div class="text-sm text-white">{mistake.name}</div>
									<div class="text-[11px] text-gray-500">{mistake.count} เทรดที่ติดแท็ก</div>
								</div>
								<div class="text-sm font-medium text-red-400">{formatCurrency(mistake.cost)}</div>
							</div>
						{/each}
					{:else}
						<EmptyState message="ยังไม่มีแท็กข้อผิดพลาดในเทรดที่กรอง" />
					{/if}
				</div>
			</div>
			<div class="card xl:col-span-1">
				<h2 class="text-sm font-semibold text-gray-300 mb-4">แยกตามระยะเวลาถือ</h2>
				<div class="space-y-2">
					{#each report.durationBuckets || [] as bucket}
						<div class="rounded-xl bg-dark-bg/30 px-3 py-3">
							<div class="flex items-center justify-between">
								<div class="text-sm text-white uppercase">{bucket.bucket}</div>
								<div class="{bucket.profit >= 0 ? 'text-green-400' : 'text-red-400'} text-sm font-medium">{formatCurrency(bucket.profit)}</div>
							</div>
							<div class="mt-1 text-[11px] text-gray-500">{bucket.count} เทรด • เฉลี่ย {bucket.avgMinutes} นาที</div>
						</div>
					{/each}
				</div>
			</div>
			<div class="card xl:col-span-1">
				<h2 class="text-sm font-semibold text-gray-300 mb-4">เป้าหมายความคืบหน้า</h2>
				<div class="space-y-3">
					{#each report.progressSnapshot || [] as goal}
						<div>
							<div class="flex items-center justify-between text-xs mb-1">
								<span class="text-gray-400">{goal.goal_type}</span>
								<span class="text-white">{goal.currentValue.toFixed(1)} / {goal.target_value}</span>
							</div>
							<div class="w-full bg-dark-border rounded-full h-2">
								<div class="bg-brand-primary rounded-full h-2" style={`width: ${goal.progress}%`}></div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

	{:else if activeTab === 'performance'}
		<!-- PERFORMANCE VIEW — Dual Configurable Charts -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<div class="card">
				{#if ConfigurableMetricChart}
					<svelte:component
						this={ConfigurableMetricChart}
						dailyHistory={calendarDays?.map((d: any) => ({ date: d.date, profit: d.pnl, totalTrades: d.trades })) || []}
						defaultMetric="net_pnl_cumulative"
						defaultTimeframe="day"
						height={280}
					/>
				{:else}
					<div class="animate-pulse space-y-3">
						<div class="h-4 bg-dark-border rounded w-1/3"></div>
						<div class="h-[280px] bg-dark-border/50 rounded-lg"></div>
					</div>
				{/if}
			</div>
			<div class="card">
				{#if ConfigurableMetricChart}
					<svelte:component
						this={ConfigurableMetricChart}
						dailyHistory={calendarDays?.map((d: any) => ({ date: d.date, profit: d.pnl, totalTrades: d.trades })) || []}
						defaultMetric="win_rate"
						defaultTimeframe="day"
						height={280}
					/>
				{:else}
					<div class="animate-pulse space-y-3">
						<div class="h-4 bg-dark-border rounded w-1/3"></div>
						<div class="h-[280px] bg-dark-border/50 rounded-lg"></div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Summary stats -->
		{#if kpiMetrics}
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<div class="card border-l-2 {kpiMetrics.netPnl >= 0 ? 'border-l-green-500' : 'border-l-red-500'}">
					<div class="text-xs text-gray-500 uppercase tracking-wider">กำไรสุทธิ</div>
					<div class="mt-1.5 text-2xl font-bold {kpiMetrics.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(kpiMetrics.netPnl)}</div>
				</div>
				<div class="card border-l-2 {kpiMetrics.tradeWinRate >= 50 ? 'border-l-green-500' : 'border-l-amber-500'}">
					<div class="text-xs text-gray-500 uppercase tracking-wider">อัตราชนะ</div>
					<div class="mt-1.5 text-2xl font-bold {kpiMetrics.tradeWinRate >= 50 ? 'text-green-400' : 'text-amber-400'}">{kpiMetrics.tradeWinRate.toFixed(1)}%</div>
				</div>
				<div class="card border-l-2 {kpiMetrics.profitFactor >= 1 ? 'border-l-green-500' : 'border-l-red-500'}">
					<div class="text-xs text-gray-500 uppercase tracking-wider">อัตราส่วนกำไร</div>
					<div class="mt-1.5 text-2xl font-bold {kpiMetrics.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{kpiMetrics.profitFactor >= 999 ? '∞' : formatNumber(kpiMetrics.profitFactor)}</div>
				</div>
				<div class="card border-l-2 {kpiMetrics.dayWinRate >= 50 ? 'border-l-green-500' : 'border-l-amber-500'}">
					<div class="text-xs text-gray-500 uppercase tracking-wider">อัตราชนะรายวัน</div>
					<div class="mt-1.5 text-2xl font-bold {kpiMetrics.dayWinRate >= 50 ? 'text-green-400' : 'text-amber-400'}">{kpiMetrics.dayWinRate.toFixed(1)}%</div>
				</div>
			</div>

			{#if healthScore}
				<div class="mt-4 max-w-xs">
					<HealthScoreCard score={healthScore.score} />
				</div>
			{/if}
		{/if}

	{:else if activeTab === 'calendar'}
		<!-- CALENDAR YEAR VIEW -->
		<div class="card">
			<div class="flex items-center justify-between mb-6">
				<button onclick={() => calendarYear--} aria-label="ปีที่แล้ว" class="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-bg/50">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
				</button>
				<h2 class="text-xl font-bold text-white">{calendarYear}</h2>
				<button onclick={() => calendarYear++} aria-label="ปีถัดไป" class="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-bg/50">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
				</button>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
				{#each Array(12) as _, monthIdx}
					{@const grid = getMonthGrid(calendarYear, monthIdx)}
					<div>
						<h3 class="text-sm font-semibold text-gray-300 mb-2">{monthNames[monthIdx]}</h3>
						<div class="grid grid-cols-7 gap-0.5">
							{#each dayLabels as label}
								<div class="text-center text-[9px] text-gray-600 py-0.5">{label}</div>
							{/each}
							{#each grid as cell}
								{#if cell}
									<div
										class="aspect-square flex items-center justify-center text-[10px] rounded {calDayBg(cell.pnl, cell.trades)}"
										title={cell.trades > 0 ? `${cell.date}: ${formatCurrency(cell.pnl)} (${cell.trades} เทรด)` : cell.date}
									>
										{cell.day}
									</div>
								{:else}
									<div></div>
								{/if}
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<!-- Legend -->
			<div class="mt-6 flex items-center gap-4 text-xs text-gray-500">
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-green-500/30"></div> กำไร</div>
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-red-500/30"></div> ขาดทุน</div>
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-dark-bg"></div> ไม่มีเทรด</div>
			</div>
		</div>

	{:else if activeTab === 'symbols'}
		<!-- SYMBOLS BREAKDOWN -->
		<div class="card">
			<h2 class="text-lg font-semibold text-white mb-4">ผลลัพธ์ตามสัญลักษณ์</h2>
			{#if sortedSymbols.length === 0}
				<EmptyState message="ไม่พบข้อมูล symbol ใน filter ที่เลือก" />
			{:else}
				<!-- Top symbols bar chart -->
				{@const maxAbsPnl = Math.max(...sortedSymbols.map((s: any) => Math.abs(s.netPnl)), 1)}
				<div class="space-y-2 mb-6">
					{#each sortedSymbols.slice(0, 8) as sym}
						<div class="flex items-center gap-3">
							<div class="w-20 text-sm font-medium text-white">{sym.symbol}</div>
							<div class="flex-1 flex items-center">
								{#if sym.netPnl >= 0}
									<div class="h-5 rounded-r bg-green-500/50" style="width: {(sym.netPnl / maxAbsPnl) * 100}%"></div>
								{:else}
									<div class="h-5 rounded-l bg-red-500/50 ml-auto" style="width: {(Math.abs(sym.netPnl) / maxAbsPnl) * 100}%"></div>
								{/if}
							</div>
							<div class="w-24 text-right text-sm font-medium {sym.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">
								{formatCurrency(sym.netPnl)}
							</div>
						</div>
					{/each}
				</div>

				<!-- Full table -->
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-[11px] uppercase tracking-wider">
								<th class="text-left py-2.5 font-medium">สัญลักษณ์</th>
								{#each [
									{ key: 'trades', label: 'เทรด' },
									{ key: 'winRate', label: 'อัตราชนะ' },
									{ key: 'profitFactor', label: 'PF' },
									{ key: 'netPnl', label: 'กำไรสุทธิ' },
									{ key: 'avgPnl', label: 'เฉลี่ย' },
								] as col}
									<th class="text-right py-2.5 font-medium cursor-pointer hover:text-gray-300 select-none" onclick={() => toggleSort(col.key)}>
										{col.label}
										{#if symbolSort.key === col.key}
											<span class="ml-0.5">{symbolSort.asc ? '▲' : '▼'}</span>
										{/if}
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each sortedSymbols as sym}
								<tr class="border-b border-dark-border/40 hover:bg-dark-bg/30">
									<td class="py-2.5 font-medium text-white">{sym.symbol}</td>
									<td class="py-2.5 text-right text-gray-300">{sym.trades}</td>
									<td class="py-2.5 text-right {sym.winRate >= 50 ? 'text-green-400' : 'text-red-400'}">{sym.winRate.toFixed(0)}%</td>
									<td class="py-2.5 text-right {sym.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{sym.profitFactor === Infinity ? '∞' : formatNumber(sym.profitFactor)}</td>
									<td class="py-2.5 text-right font-medium {sym.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(sym.netPnl)}</td>
									<td class="py-2.5 text-right {sym.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(sym.avgPnl)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

	{:else if activeTab === 'tags'}
		<!-- TAG PERFORMANCE -->
		<div class="card">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-lg font-semibold text-white">ผลลัพธ์ตามแท็ก</h2>
				<!-- Category filter pills -->
				<div class="flex gap-1.5 flex-wrap">
					<button
						class="px-3 py-1 text-xs rounded-full border transition-colors {tagViewMode === 'all' ? 'bg-brand-primary/20 text-brand-primary border-brand-primary/40' : 'text-gray-400 border-dark-border hover:text-gray-300'}"
						onclick={() => tagViewMode = 'all'}
					>ทั้งหมด</button>
					{#each Object.entries(categoryLabels) as [key, label]}
						{#if tagBreakdown?.byCategory?.some((c: any) => c.category === key)}
							<button
								class="px-3 py-1 text-xs rounded-full border transition-colors {tagViewMode === key ? 'bg-brand-primary/20 text-brand-primary border-brand-primary/40' : 'text-gray-400 border-dark-border hover:text-gray-300'}"
								onclick={() => tagViewMode = key}
							>{label}</button>
						{/if}
					{/each}
				</div>
			</div>

			{#if !tagBreakdown || tagBreakdown.byTag.length === 0}
				<EmptyState message="ยังไม่มีแท็กในเทรดที่กรอง — เพิ่มแท็กให้กับเทรดก่อน" />
			{:else}
				<!-- Category summary cards -->
				{#if tagViewMode === 'all' && tagBreakdown.byCategory.length > 0}
					<div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
						{#each tagBreakdown.byCategory as cat}
							<button
								class="rounded-xl border px-4 py-3 text-left transition-colors hover:border-brand-primary/30 {categoryColors[cat.category] || 'text-gray-400 bg-gray-500/10 border-gray-500/20'}"
								onclick={() => tagViewMode = cat.category}
							>
								<div class="text-xs opacity-70">{categoryLabels[cat.category] || cat.category}</div>
								<div class="mt-1 flex items-baseline gap-2">
									<span class="text-xl font-bold">{cat.tagCount}</span>
									<span class="text-xs opacity-60">แท็ก • {cat.trades} เทรด</span>
								</div>
								<div class="mt-1 flex items-center gap-3 text-xs">
									<span>WR {cat.winRate.toFixed(0)}%</span>
									<span class="{cat.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(cat.netPnl)}</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}

				<!-- Bar chart — top tags by P&L -->
				{@const maxAbsTagPnl = Math.max(...sortedTags.map((t: any) => Math.abs(t.netPnl)), 1)}
				<div class="space-y-2 mb-6">
					{#each sortedTags.slice(0, 10) as tag}
						<div class="flex items-center gap-3">
							<div class="w-32 flex items-center gap-2 min-w-0">
								<div class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {tag.color}"></div>
								<span class="text-sm font-medium text-white truncate">{tag.tagName}</span>
							</div>
							<div class="flex-1 flex items-center">
								{#if tag.netPnl >= 0}
									<div class="h-5 rounded-r bg-green-500/50" style="width: {(tag.netPnl / maxAbsTagPnl) * 100}%"></div>
								{:else}
									<div class="h-5 rounded-l bg-red-500/50 ml-auto" style="width: {(Math.abs(tag.netPnl) / maxAbsTagPnl) * 100}%"></div>
								{/if}
							</div>
							<div class="w-24 text-right text-sm font-medium {tag.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">
								{formatCurrency(tag.netPnl)}
							</div>
						</div>
					{/each}
				</div>

				<!-- Full sortable table -->
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-[11px] uppercase tracking-wider">
								<th class="text-left py-2.5 font-medium">แท็ก</th>
								<th class="text-left py-2.5 font-medium">หมวดหมู่</th>
								{#each [
									{ key: 'trades', label: 'เทรด' },
									{ key: 'winRate', label: 'อัตราชนะ' },
									{ key: 'profitFactor', label: 'PF' },
									{ key: 'netPnl', label: 'กำไรสุทธิ' },
									{ key: 'avgPnl', label: 'เฉลี่ย' },
								] as col}
									<th class="text-right py-2.5 font-medium cursor-pointer hover:text-gray-300 select-none" onclick={() => toggleTagSort(col.key)}>
										{col.label}
										{#if tagSort.key === col.key}
											<span class="ml-0.5">{tagSort.asc ? '▲' : '▼'}</span>
										{/if}
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each sortedTags as tag}
								<tr class="border-b border-dark-border/40 hover:bg-dark-bg/30">
									<td class="py-2.5">
										<div class="flex items-center gap-2">
											<div class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {tag.color}"></div>
											<span class="font-medium text-white">{tag.tagName}</span>
										</div>
									</td>
									<td class="py-2.5">
										<span class="text-xs px-2 py-0.5 rounded-full border {categoryColors[tag.category] || 'text-gray-400 border-gray-500/20'}">
											{categoryLabels[tag.category] || tag.category}
										</span>
									</td>
									<td class="py-2.5 text-right text-gray-300">{tag.trades}</td>
									<td class="py-2.5 text-right {tag.winRate >= 50 ? 'text-green-400' : 'text-red-400'}">{tag.winRate.toFixed(0)}%</td>
									<td class="py-2.5 text-right {tag.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{tag.profitFactor === Infinity ? '∞' : formatNumber(tag.profitFactor)}</td>
									<td class="py-2.5 text-right font-medium {tag.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(tag.netPnl)}</td>
									<td class="py-2.5 text-right {tag.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(tag.avgPnl)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

	{:else if activeTab === 'days'}
		<!-- DAY OF WEEK REPORT -->
		<div class="card">
			<h2 class="text-lg font-semibold text-white mb-4">ผลลัพธ์ตามวันในสัปดาห์</h2>

			{#if !dayOfWeekReport || dayOfWeekReport.days.length === 0}
				<EmptyState message="ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์รายวัน" />
			{:else}
				<!-- Best / Worst Day -->
				<div class="grid grid-cols-2 gap-4 mb-6">
					<div class="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3">
						<div class="text-xs text-green-400/70">วันที่ดีที่สุด</div>
						<div class="text-2xl font-bold text-green-400 mt-1">{dayOfWeekReport.bestDay}</div>
					</div>
					<div class="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
						<div class="text-xs text-red-400/70">วันที่แย่ที่สุด</div>
						<div class="text-2xl font-bold text-red-400 mt-1">{dayOfWeekReport.worstDay}</div>
					</div>
				</div>

				<!-- Bar chart -->
				{@const maxAbsDayPnl = Math.max(...sortedDays.map((d: any) => Math.abs(d.netPnl)), 1)}
				<div class="space-y-2 mb-6">
					{#each dayOfWeekReport.days.sort((a: any, b: any) => a.dayIdx - b.dayIdx) as day}
						<div class="flex items-center gap-3">
							<div class="w-10 text-sm font-semibold text-gray-300 shrink-0">{day.day}</div>
							<div class="flex-1 flex items-center">
								{#if day.netPnl >= 0}
									<div class="h-6 rounded-r bg-green-500/40" style="width: {(day.netPnl / maxAbsDayPnl) * 100}%"></div>
								{:else}
									<div class="h-6 rounded-l bg-red-500/40 ml-auto" style="width: {(Math.abs(day.netPnl) / maxAbsDayPnl) * 100}%"></div>
								{/if}
							</div>
							<div class="w-24 text-right text-sm font-medium {day.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">
								{formatCurrency(day.netPnl)}
							</div>
						</div>
					{/each}
				</div>

				<!-- Sortable table -->
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-[11px] uppercase tracking-wider">
								{#each [
									{ key: 'dayIdx', label: 'วัน' },
									{ key: 'trades', label: 'เทรด' },
									{ key: 'winRate', label: 'อัตราชนะ' },
									{ key: 'profitFactor', label: 'PF' },
									{ key: 'netPnl', label: 'กำไรสุทธิ' },
									{ key: 'avgPnl', label: 'เฉลี่ย' },
									{ key: 'avgHoldMinutes', label: 'ถือเฉลี่ย' },
									{ key: 'bestTrade', label: 'ดีสุด' },
									{ key: 'worstTrade', label: 'แย่สุด' },
								] as col}
									<th class="{col.key === 'dayIdx' ? 'text-left' : 'text-right'} py-2.5 font-medium cursor-pointer hover:text-gray-300 select-none" onclick={() => toggleDaySort(col.key)}>
										{col.label}
										{#if daySort.key === col.key}
											<span class="ml-0.5">{daySort.asc ? '▲' : '▼'}</span>
										{/if}
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each sortedDays as day}
								<tr class="border-b border-dark-border/40 hover:bg-dark-bg/30">
									<td class="py-2.5 font-medium text-white">{day.day}</td>
									<td class="py-2.5 text-right text-gray-300">{day.trades}</td>
									<td class="py-2.5 text-right {day.winRate >= 50 ? 'text-green-400' : 'text-red-400'}">{day.winRate.toFixed(0)}%</td>
									<td class="py-2.5 text-right {day.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{day.profitFactor === Infinity ? '∞' : formatNumber(day.profitFactor)}</td>
									<td class="py-2.5 text-right font-medium {day.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(day.netPnl)}</td>
									<td class="py-2.5 text-right {day.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(day.avgPnl)}</td>
									<td class="py-2.5 text-right text-gray-300">{formatHoldTime(day.avgHoldMinutes)}</td>
									<td class="py-2.5 text-right text-green-400">{formatCurrency(day.bestTrade)}</td>
									<td class="py-2.5 text-right text-red-400">{formatCurrency(day.worstTrade)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

	{:else if activeTab === 'daytime'}
		<!-- DAY & TIME HEATMAP -->
		<div class="card">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-lg font-semibold text-white">แผนที่ความร้อน วัน & เวลา</h2>
				<div class="flex gap-1 bg-dark-bg rounded-lg p-1">
					{#each [
						{ key: 'pnl', label: 'กำไร/ขาดทุน' },
						{ key: 'trades', label: 'เทรด' },
						{ key: 'winRate', label: 'อัตราชนะ' },
					] as mode}
						<button
							class="px-3 py-1 text-xs font-medium rounded-md transition-all {heatmapMode === mode.key ? 'bg-dark-surface text-brand-primary shadow-sm' : 'text-gray-400 hover:text-gray-300'}"
							onclick={() => heatmapMode = mode.key as any}
						>{mode.label}</button>
					{/each}
				</div>
			</div>

			<p class="text-xs text-gray-500 mb-4">เวลาแสดงเป็น UTC+7 (เวลาไทย)</p>

			{#if !dayTimeHeatmap || dayTimeHeatmap.cells.length === 0}
				<EmptyState message="ยังไม่มีข้อมูลเพียงพอสำหรับ heatmap" />
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full border-collapse">
						<thead>
							<tr>
								<th class="w-12"></th>
								{#each hourLabels as label, i}
									{#if i % 2 === 0}
										<th class="text-[9px] text-gray-500 font-normal px-0.5 pb-1" colspan="2">{label}</th>
									{/if}
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each dayLabelsHeatmap as dayName, dayIdx}
								<tr>
									<td class="text-xs text-gray-400 font-medium pr-2 py-0.5">{dayName}</td>
									{#each Array(24) as _, hour}
										{@const cell = getHeatmapCell(dayIdx, hour)}
										<td
											class="p-0.5"
											title={cell ? `${dayName} ${String(hour).padStart(2, '0')}:00 — ${cell.trades} เทรด, ${formatCurrency(cell.pnl)}, ชนะ ${cell.winRate.toFixed(0)}%` : `${dayName} ${String(hour).padStart(2, '0')}:00 — ไม่มีเทรด`}
										>
											<div class="w-full aspect-square rounded-sm min-w-[16px] {heatmapCellColor(cell)}"></div>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Legend -->
				<div class="mt-4 flex items-center gap-4 text-xs text-gray-500">
					{#if heatmapMode === 'pnl'}
						<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-green-500/60"></div> กำไร</div>
						<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-red-500/60"></div> ขาดทุน</div>
					{:else if heatmapMode === 'trades'}
						<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-blue-500/20"></div> น้อย</div>
						<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-blue-500/40"></div> ปานกลาง</div>
						<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-blue-500/70"></div> มาก</div>
					{:else}
						<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-green-500/60"></div> >70%</div>
						<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-green-500/30"></div> 50-70%</div>
						<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-red-500/30"></div> 30-50%</div>
						<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-red-500/60"></div> &lt;30%</div>
					{/if}
					<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-dark-bg/20"></div> ไม่มีเทรด</div>
				</div>
			{/if}
		</div>

	{:else if activeTab === 'risk'}
		<!-- RISK ANALYSIS -->
		{#if !riskAnalysis}
			<div class="card">
				<EmptyState message="ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์ความเสี่ยง" />
			</div>
		{:else}
			<!-- Risk KPI Cards -->
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<div class="card border-l-2 border-l-red-500">
					<div class="text-xs text-gray-500 uppercase tracking-wider">Drawdown สูงสุด</div>
					<div class="mt-1.5 text-2xl font-bold text-red-400">{formatCurrency(riskAnalysis.maxDrawdown)}</div>
					{#if riskAnalysis.maxDrawdownDate}
						<div class="text-xs text-gray-500 mt-1">{riskAnalysis.maxDrawdownDate}</div>
					{/if}
				</div>
				<div class="card border-l-2 border-l-amber-500">
					<div class="text-xs text-gray-500 uppercase tracking-wider">Drawdown เฉลี่ย</div>
					<div class="mt-1.5 text-2xl font-bold text-amber-400">{formatCurrency(riskAnalysis.avgDrawdown)}</div>
					<div class="text-xs text-gray-500 mt-1">{riskAnalysis.drawdownPeriodCount} ช่วง</div>
				</div>
				<div class="card border-l-2 border-l-red-400">
					<div class="text-xs text-gray-500 uppercase tracking-wider">ขาดทุนสูงสุด</div>
					<div class="mt-1.5 text-2xl font-bold text-red-400">{formatCurrency(riskAnalysis.largestLoss)}</div>
				</div>
				<div class="card border-l-2 border-l-orange-500">
					<div class="text-xs text-gray-500 uppercase tracking-wider">แพ้ติดต่อสูงสุด</div>
					<div class="mt-1.5 text-2xl font-bold text-orange-400">{riskAnalysis.maxLossStreak} เทรด</div>
				</div>
			</div>

			<!-- Risk-adjusted Ratios -->
			<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
				{#each [
					{ label: 'Sharpe Ratio', value: riskAnalysis.sharpeRatio, good: 1, great: 2 },
					{ label: 'Sortino Ratio', value: riskAnalysis.sortinoRatio, good: 1.5, great: 3 },
					{ label: 'Calmar Ratio', value: riskAnalysis.calmarRatio, good: 1, great: 3 },
					{ label: 'ความผันผวนรายวัน', value: riskAnalysis.dailyVolatility, good: -1, great: -1 },
					{ label: 'ผลตอบแทนเฉลี่ย/วัน', value: riskAnalysis.avgDailyReturn, good: 0, great: 0.1 }
				] as ratio}
					{@const color = ratio.label === 'ความผันผวนรายวัน'
						? 'text-gray-300'
						: ratio.value >= ratio.great ? 'text-green-400' : ratio.value >= ratio.good ? 'text-amber-400' : 'text-red-400'}
					<div class="card text-center">
						<div class="text-xs text-gray-500 uppercase tracking-wider">{ratio.label}</div>
						<div class="mt-2 text-xl font-bold {color}">
							{ratio.label.includes('ผันผวน') || ratio.label.includes('ผลตอบแทน')
								? `${ratio.value.toFixed(2)}%`
								: ratio.value.toFixed(2)}
						</div>
					</div>
				{/each}
			</div>

			<!-- Drawdown Chart -->
			<div class="card">
				<h3 class="text-sm font-semibold text-white mb-4">กราฟ Drawdown</h3>
				{#if riskAnalysis.drawdownSeries.length === 0}
					<EmptyState message="ยังไม่มีข้อมูล drawdown" />
				{:else}
					{@const series = riskAnalysis.drawdownSeries}
					{@const minDD = Math.min(...series.map((s: { drawdown: number }) => s.drawdown))}
					{@const range = -minDD || 1}
					<div class="h-64 relative">
						<svg class="w-full h-full" viewBox="0 0 {series.length * 10} 200" preserveAspectRatio="none">
							<line x1="0" y1="0" x2="{series.length * 10}" y2="0" stroke="#4B5563" stroke-width="0.5" />
							<path
								d="M0,0 {series.map((s: { drawdown: number }, i: number) => `L${i * 10},${(-s.drawdown / range) * 200}`).join(' ')} L{(series.length - 1) * 10},0 Z"
								fill="rgba(239, 68, 68, 0.15)"
							/>
							<path
								d="M0,{(-series[0].drawdown / range) * 200} {series.map((s: { drawdown: number }, i: number) => `L${i * 10},${(-s.drawdown / range) * 200}`).join(' ')}"
								fill="none"
								stroke="#EF4444"
								stroke-width="1.5"
							/>
						</svg>
						<div class="flex justify-between text-[10px] text-gray-500 mt-1 px-1">
							<span>{series[0]?.date || ''}</span>
							{#if series.length > 2}
								<span>{series[Math.floor(series.length / 2)]?.date || ''}</span>
							{/if}
							<span>{series[series.length - 1]?.date || ''}</span>
						</div>
						<div class="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-gray-500 pointer-events-none">
							<span>$0</span>
							<span>{formatCurrency(minDD)}</span>
						</div>
					</div>
				{/if}
			</div>

			<!-- Drawdown Periods Table + R:R Distribution -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Drawdown Periods -->
				<div class="card">
					<h3 class="text-sm font-semibold text-white mb-4">ช่วง Drawdown (10 อันดับ)</h3>
					{#if riskAnalysis.topDrawdowns.length === 0}
						<EmptyState message="ไม่พบ drawdown periods" />
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-dark-border text-gray-500 text-[11px] uppercase tracking-wider">
										<th class="text-left py-2 font-medium">เริ่มต้น</th>
										<th class="text-right py-2 font-medium">DD สูงสุด</th>
										<th class="text-right py-2 font-medium">ระยะเวลา</th>
										<th class="text-right py-2 font-medium">ฟื้นตัว</th>
									</tr>
								</thead>
								<tbody>
									{#each riskAnalysis.topDrawdowns as period}
										<tr class="border-b border-dark-border/40 hover:bg-dark-bg/30">
											<td class="py-2 text-gray-300 text-xs">{period.startDate}</td>
											<td class="py-2 text-right text-red-400 font-medium">{formatCurrency(period.maxDrawdown)}</td>
											<td class="py-2 text-right text-gray-300">{period.durationDays}d</td>
											<td class="py-2 text-right {period.recoveryDate ? 'text-green-400' : 'text-amber-400'}">
												{period.recoveryDays !== null ? `${period.recoveryDays}d` : 'ยังไม่ฟื้นตัว'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<div class="mt-3 text-xs text-gray-500">
							ระยะเวลาเฉลี่ย: {riskAnalysis.avgDrawdownDuration} วัน
						</div>
					{/if}
				</div>

				<!-- R:R Distribution -->
				<div class="card">
					<h3 class="text-sm font-semibold text-white mb-4">การกระจาย R:R</h3>
					{#if riskAnalysis.totalRRTrades === 0}
						<EmptyState message="ไม่มีเทรดที่มี Stop Loss สำหรับคำนวณ R:R" />
					{:else}
						<div class="space-y-3">
							{#each riskAnalysis.rrDistribution as bucket}
								{@const maxCount = Math.max(...riskAnalysis.rrDistribution.map((b: { count: number }) => b.count), 1)}
								{@const pct = bucket.count > 0 ? (bucket.count / riskAnalysis.totalRRTrades) * 100 : 0}
								{@const winPct = bucket.count > 0 ? (bucket.wins / bucket.count) * 100 : 0}
								<div>
									<div class="flex justify-between text-xs mb-1">
										<span class="text-gray-400">{bucket.label} R:R</span>
										<span class="text-gray-300">{bucket.count} เทรด ({pct.toFixed(0)}%)</span>
									</div>
									<div class="h-5 bg-dark-bg rounded-full overflow-hidden flex">
										{#if bucket.count > 0}
											<div
												class="h-full bg-green-500/60 transition-all"
												style="width: {(bucket.wins / maxCount) * 100}%"
											></div>
											<div
												class="h-full bg-red-500/60 transition-all"
												style="width: {(bucket.losses / maxCount) * 100}%"
											></div>
										{/if}
									</div>
									{#if bucket.count > 0}
										<div class="flex justify-between text-[10px] mt-0.5">
											<span class="text-green-400">ชนะ {winPct.toFixed(0)}%</span>
											<span class="text-red-400">แพ้ {(100 - winPct).toFixed(0)}%</span>
										</div>
									{/if}
								</div>
							{/each}
						</div>
						<div class="mt-3 text-xs text-gray-500">
							จากเทรดทั้งหมด {riskAnalysis.totalRRTrades} เทรดที่มี Stop Loss
						</div>
					{/if}
				</div>
			</div>

			<!-- Risk Summary Row -->
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<div class="card text-center">
					<div class="text-xs text-gray-500 uppercase tracking-wider">ส่วนเบี่ยงเบน P&L/วัน</div>
					<div class="mt-2 text-lg font-bold text-gray-300">{formatCurrency(riskAnalysis.dailyStdDev)}</div>
				</div>
				<div class="card text-center">
					<div class="text-xs text-gray-500 uppercase tracking-wider">กำไรเฉลี่ย/วัน</div>
					<div class="mt-2 text-lg font-bold {riskAnalysis.dailyMean >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(riskAnalysis.dailyMean)}</div>
				</div>
				<div class="card text-center">
					<div class="text-xs text-gray-500 uppercase tracking-wider">ชนะมากสุด</div>
					<div class="mt-2 text-lg font-bold text-green-400">{formatCurrency(riskAnalysis.largestWin)}</div>
				</div>
				<div class="card text-center">
					<div class="text-xs text-gray-500 uppercase tracking-wider">จำนวนช่วง DD</div>
					<div class="mt-2 text-lg font-bold text-gray-300">{riskAnalysis.drawdownPeriodCount}</div>
				</div>
			</div>
		{/if}

	{:else if activeTab === 'recaps'}
		<!-- RECAPS & INSIGHTS -->
		<div class="space-y-6">
			<!-- Period selector -->
			<div class="flex flex-wrap items-center gap-2">
				<div class="flex gap-1.5 flex-wrap">
					{#each ['last_week', 'this_week', 'last_month', 'this_month'] as period}
						<button
							class="px-4 py-2 text-sm rounded-lg border transition-colors {recapPeriod === period ? 'bg-brand-primary/20 text-brand-primary border-brand-primary/40' : 'text-gray-400 border-dark-border hover:text-gray-300'}"
							onclick={() => { recapPeriod = period as any; recapStats = null; recapTimestamp = ''; for (const k of Object.keys(recapSections)) recapSections[k] = { content: '', loading: false }; }}
						>{recapPeriodLabels[period]}</button>
					{/each}
				</div>
				{#if recapTimestamp}
					<div class="text-xs text-gray-500">สรุปเมื่อ: {recapTimestamp}</div>
				{/if}
			</div>

			<!-- Stats snapshot -->
			{#if recapStats}
				<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
					<div class="card">
						<div class="text-xs text-gray-500">กำไรสุทธิ</div>
						<div class="mt-1 text-2xl font-bold {recapStats.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(recapStats.netPnl)}</div>
						{#if recapPrevStats}
							<div class="mt-1 text-xs {recapStats.netPnl >= recapPrevStats.netPnl ? 'text-green-400' : 'text-red-400'}">
								{recapStats.netPnl >= recapPrevStats.netPnl ? '↑' : '↓'} เทียบ {formatCurrency(recapPrevStats.netPnl)}
							</div>
						{/if}
					</div>
					<div class="card">
						<div class="text-xs text-gray-500">อัตราชนะ</div>
						<div class="mt-1 text-2xl font-bold {recapStats.tradeWinRate >= 50 ? 'text-green-400' : 'text-amber-400'}">{recapStats.tradeWinRate?.toFixed(1)}%</div>
						{#if recapPrevStats}
							<div class="mt-1 text-xs {recapStats.tradeWinRate >= recapPrevStats.tradeWinRate ? 'text-green-400' : 'text-red-400'}">
								{recapStats.tradeWinRate >= recapPrevStats.tradeWinRate ? '↑' : '↓'} เทียบ {recapPrevStats.tradeWinRate?.toFixed(1)}%
							</div>
						{/if}
					</div>
					<div class="card">
						<div class="text-xs text-gray-500">อัตราส่วนกำไร</div>
						<div class="mt-1 text-2xl font-bold {recapStats.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{formatNumber(recapStats.profitFactor)}</div>
					</div>
					<div class="card">
						<div class="text-xs text-gray-500">จำนวนเทรด</div>
						<div class="mt-1 text-2xl font-bold text-white">{recapStats.totalTrades}</div>
					</div>
				</div>
			{/if}

			{#if recapError}
				<div class="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
					{recapError}
				</div>
			{/if}

			<!-- Generate button or sections -->
			{#if !recapSections.performance_summary.content && !recapGenerating}
				<div class="card text-center py-12">
					<div class="text-4xl mb-4">🤖</div>
					<h3 class="text-lg font-semibold text-white mb-2">AI Recap & Insights</h3>
					<p class="text-sm text-gray-400 mb-6">สรุปผลการเทรด{recapPeriodLabels[recapPeriod]} วิเคราะห์จุดแข็ง จุดอ่อน และแผนปรับปรุง</p>
					<div class="flex gap-3 justify-center">
						<button
							onclick={async () => { if (await loadCachedRecap()) return; generateRecap(); }}
							class="px-6 py-3 rounded-lg bg-brand-primary text-dark-bg font-semibold hover:opacity-90 transition-opacity"
						>สรุปผลด้วย AI</button>
					</div>
				</div>
			{:else}
				<!-- Streaming sections -->
				<div class="space-y-4">
					{#each recapSectionConfig as cfg}
						{@const section = recapSections[cfg.key]}
						{#if section?.content || section?.loading || recapGenerating}
							<div class="card">
								<div class="flex items-center gap-2 mb-3">
									<span class="text-lg">{cfg.icon}</span>
									<h3 class="text-base font-semibold text-white">{cfg.title}</h3>
									{#if section?.loading}
										<div class="ml-auto flex items-center gap-1.5 text-xs text-brand-primary">
											<div class="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></div>
											กำลังวิเคราะห์...
										</div>
									{/if}
								</div>
								{#if section?.content}
									<div class="prose-sm text-gray-300 leading-relaxed">
										{@html recapRenderMarkdown(section.content)}
									</div>
								{:else if !section?.loading && recapGenerating}
									<!-- Skeleton -->
									<div class="space-y-2 animate-pulse">
										<div class="h-3 bg-dark-border rounded w-3/4"></div>
										<div class="h-3 bg-dark-border rounded w-1/2"></div>
										<div class="h-3 bg-dark-border rounded w-5/6"></div>
									</div>
								{/if}
							</div>
						{/if}
					{/each}
				</div>

				<!-- Regenerate button -->
				{#if !recapGenerating && recapSections.performance_summary.content}
					<div class="flex justify-end">
						<button
							onclick={generateRecap}
							class="flex items-center gap-2 px-4 py-2 rounded-lg border border-dark-border text-sm text-gray-400 hover:text-white hover:border-brand-primary/40 transition-colors"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
							สร้างใหม่
						</button>
					</div>
				{/if}
			{/if}
		</div>

	{:else if activeTab === 'compare'}
		<!-- COMPARE TOOL -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<div class="card">
				<h3 class="text-sm font-semibold text-white mb-4">กลุ่ม #1</h3>
				<div class="space-y-3">
					<div>
						<label for="g1-symbol" class="text-xs text-gray-500">สัญลักษณ์</label>
						<select id="g1-symbol" bind:value={group1Symbol} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
							<option value="">ทุกสัญลักษณ์</option>
							{#each availableSymbols as sym}
								<option value={sym}>{sym}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="g1-side" class="text-xs text-gray-500">ทิศทาง</label>
						<select id="g1-side" bind:value={group1Side} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
							<option value="">ทุกทิศทาง</option>
							<option value="BUY">BUY</option>
							<option value="SELL">SELL</option>
						</select>
					</div>
				</div>
			</div>
			<div class="card">
				<h3 class="text-sm font-semibold text-white mb-4">กลุ่ม #2</h3>
				<div class="space-y-3">
					<div>
						<label for="g2-symbol" class="text-xs text-gray-500">สัญลักษณ์</label>
						<select id="g2-symbol" bind:value={group2Symbol} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
							<option value="">ทุกสัญลักษณ์</option>
							{#each availableSymbols as sym}
								<option value={sym}>{sym}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="g2-side" class="text-xs text-gray-500">ทิศทาง</label>
						<select id="g2-side" bind:value={group2Side} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
							<option value="">ทุกทิศทาง</option>
							<option value="BUY">BUY</option>
							<option value="SELL">SELL</option>
						</select>
					</div>
				</div>
			</div>
		</div>

		<div class="flex gap-3 justify-end">
			<button
				onclick={() => { group1Symbol = ''; group1Side = ''; group2Symbol = ''; group2Side = ''; compareResult = null; }}
				class="px-4 py-2 rounded-lg border border-dark-border text-sm text-gray-400 hover:text-white"
			>รีเซ็ต</button>
			<button
				onclick={generateCompare}
				class="px-6 py-2 rounded-lg bg-brand-primary text-dark-bg text-sm font-semibold hover:opacity-90"
			>สร้างรายงาน</button>
		</div>

		{#if compareResult}
			<div class="card">
				<h3 class="text-sm font-semibold text-white mb-4">ผลการเปรียบเทียบ</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-[11px] uppercase tracking-wider">
								<th class="text-left py-2.5 font-medium">ตัวชี้วัด</th>
								<th class="text-right py-2.5 font-medium">กลุ่ม #1</th>
								<th class="text-right py-2.5 font-medium">กลุ่ม #2</th>
								<th class="text-right py-2.5 font-medium">ผลต่าง</th>
							</tr>
						</thead>
						<tbody>
							{#each [
								{ label: 'จำนวนเทรด', g1: compareResult.group1.trades, g2: compareResult.group2.trades, fmt: 'num' },
								{ label: 'อัตราชนะ', g1: compareResult.group1.winRate, g2: compareResult.group2.winRate, fmt: 'pct' },
								{ label: 'อัตราส่วนกำไร', g1: compareResult.group1.profitFactor, g2: compareResult.group2.profitFactor, fmt: 'num' },
								{ label: 'กำไรสุทธิ', g1: compareResult.group1.netPnl, g2: compareResult.group2.netPnl, fmt: 'cur' },
								{ label: 'กำไรเฉลี่ย', g1: compareResult.group1.avgPnl, g2: compareResult.group2.avgPnl, fmt: 'cur' },
							] as m}
								{@const diff = m.g1 - m.g2}
								<tr class="border-b border-dark-border/40">
									<td class="py-2.5 text-gray-300">{m.label}</td>
									<td class="py-2.5 text-right text-white">
										{m.fmt === 'cur' ? formatCurrency(m.g1) : m.fmt === 'pct' ? `${m.g1.toFixed(1)}%` : formatNumber(m.g1)}
									</td>
									<td class="py-2.5 text-right text-white">
										{m.fmt === 'cur' ? formatCurrency(m.g2) : m.fmt === 'pct' ? `${m.g2.toFixed(1)}%` : formatNumber(m.g2)}
									</td>
									<td class="py-2.5 text-right font-medium {diff >= 0 ? 'text-green-400' : 'text-red-400'}">
										{diff >= 0 ? '+' : ''}{m.fmt === 'cur' ? formatCurrency(diff) : m.fmt === 'pct' ? `${diff.toFixed(1)}%` : formatNumber(diff)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

	{:else if activeTab === 'correlation'}
		<!-- CORRELATION MATRIX -->
		<div class="space-y-6">
			{#if !correlationMatrix || correlationMatrix.symbols.length < 2}
				<div class="card">
					<div class="py-12 text-center">
						<div class="w-12 h-12 rounded-full bg-dark-bg flex items-center justify-center mx-auto mb-3">
							<svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
						</div>
						<p class="text-gray-400 text-sm">ต้องการเทรดอย่างน้อย 2 สัญลักษณ์เพื่อคำนวณความสัมพันธ์</p>
						<p class="text-gray-600 text-xs mt-1">ขยายช่วงวันที่หรือปรับตัวกรองเพื่อดูข้อมูลเพิ่มเติม</p>
					</div>
				</div>
			{:else}
				<!-- Info banner -->
				<div class="rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-3 flex gap-3 items-start">
					<svg class="w-4 h-4 text-brand-primary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
					<p class="text-xs text-gray-400 leading-relaxed">
						<span class="text-white font-medium">ความสัมพันธ์ของ P&L รายวัน</span> — วัดว่าคู่สกุลเงินมีแนวโน้มขึ้นและลงพร้อมกันมากแค่ไหน
						ค่าใกล้ <span class="text-red-400">+1</span> = เคลื่อนไหวเหมือนกัน (ความเสี่ยงสูง), ค่าใกล้ <span class="text-blue-400">-1</span> = เคลื่อนไหวตรงข้าม (กระจายความเสี่ยง), ค่าใกล้ <span class="text-gray-400">0</span> = ไม่สัมพันธ์กัน
					</p>
				</div>

				<!-- Heatmap grid -->
				<div class="card overflow-x-auto">
					<h3 class="text-sm font-semibold text-white mb-5">เมทริกซ์ความสัมพันธ์ (Pearson r)</h3>
					<div class="min-w-max">
						<div class="flex">
							<!-- Top-left corner spacer -->
							<div class="w-20 shrink-0"></div>
							<!-- Column headers -->
							{#each correlationMatrix.symbols as sym}
								<div class="w-16 h-10 flex items-end justify-center pb-1">
									<span class="text-[10px] text-gray-400 font-medium rotate-[-35deg] origin-bottom-left whitespace-nowrap">{sym}</span>
								</div>
							{/each}
						</div>
						{#each correlationMatrix.symbols as symRow, i}
							<div class="flex items-center">
								<!-- Row label -->
								<div class="w-20 shrink-0 pr-2 text-right">
									<span class="text-xs text-gray-400 font-medium">{symRow}</span>
								</div>
								<!-- Cells -->
								{#each correlationMatrix.symbols as symCol, j}
									{@const val = correlationMatrix.matrix[i]?.[j] ?? null}
									{@const isDiag = i === j}
									{@const isHovered = hoveredCell?.i === i && hoveredCell?.j === j}
									<div
										class="w-16 h-12 flex items-center justify-center rounded-md m-0.5 cursor-default transition-all duration-150 relative
											{corrCellBg(val, isDiag)}
											{isHovered && !isDiag ? 'ring-1 ring-white/30 scale-105 z-10' : ''}"
										onmouseenter={() => { if (!isDiag) hoveredCell = { i, j }; }}
										onmouseleave={() => { hoveredCell = null; }}
										role="cell"
										tabindex="-1"
										aria-label="{isDiag ? symRow : `${symRow} vs ${symCol}: ${val !== null ? val.toFixed(2) : 'N/A'}`}"
									>
										{#if isDiag}
											<span class="text-xs text-gray-600">—</span>
										{:else if val === null}
											<span class="text-[10px] text-gray-600">N/A</span>
										{:else}
											<span class="text-xs {corrCellText(val, isDiag)}">{val.toFixed(2)}</span>
										{/if}
									</div>
								{/each}
							</div>
						{/each}
					</div>

					<!-- Hover tooltip -->
					{#if hoveredCell && correlationMatrix.symbols[hoveredCell.i] && correlationMatrix.symbols[hoveredCell.j]}
						{@const hv = correlationMatrix.matrix[hoveredCell.i]?.[hoveredCell.j] ?? null}
						<div class="mt-4 pt-4 border-t border-dark-border/40 flex items-center gap-3">
							<div class="flex-1 flex items-center gap-2 text-sm">
								<span class="font-medium text-white">{correlationMatrix.symbols[hoveredCell.i]}</span>
								<span class="text-gray-500">×</span>
								<span class="font-medium text-white">{correlationMatrix.symbols[hoveredCell.j]}</span>
							</div>
							{#if hv !== null}
								<div class="flex items-center gap-3">
									<span class="text-2xl font-bold {Math.abs(hv) >= 0.7 ? (hv >= 0 ? 'text-red-400' : 'text-blue-400') : Math.abs(hv) >= 0.4 ? 'text-amber-400' : 'text-gray-400'}">{hv.toFixed(3)}</span>
									<span class="text-xs text-gray-500 bg-dark-bg rounded-md px-2 py-1">{corrLabel(hv)}</span>
								</div>
							{:else}
								<span class="text-xs text-gray-500">ข้อมูลไม่เพียงพอ (ต้องการอย่างน้อย 3 วันร่วมกัน)</span>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Color legend -->
				<div class="card">
					<h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">คำอธิบายสี</h4>
					<div class="flex flex-wrap gap-3">
						<div class="flex items-center gap-2">
							<div class="w-8 h-5 rounded bg-red-500/70 shrink-0"></div>
							<span class="text-xs text-gray-400">r ≥ 0.7 สัมพันธ์สูง (เสี่ยงสูง)</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="w-8 h-5 rounded bg-amber-500/50 shrink-0"></div>
							<span class="text-xs text-gray-400">0.4 – 0.7 สัมพันธ์ปานกลาง</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="w-8 h-5 rounded bg-dark-bg/60 border border-dark-border/30 shrink-0"></div>
							<span class="text-xs text-gray-400">–0.4 – 0.4 ไม่มีความสัมพันธ์</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="w-8 h-5 rounded bg-blue-500/35 shrink-0"></div>
							<span class="text-xs text-gray-400">–0.7 – –0.4 สัมพันธ์ตรงข้ามปานกลาง</span>
						</div>
						<div class="flex items-center gap-2">
							<div class="w-8 h-5 rounded bg-blue-500/60 shrink-0"></div>
							<span class="text-xs text-gray-400">r ≤ –0.7 กระจายความเสี่ยงดี</span>
						</div>
					</div>
				</div>

				<!-- Top correlated pairs -->
				{#if correlationMatrix.topPairs.length > 0}
					<div class="card">
						<h3 class="text-sm font-semibold text-white mb-4">คู่ที่มีความสัมพันธ์สูงสุด</h3>
						<div class="space-y-2">
							{#each correlationMatrix.topPairs as pair}
								{@const absR = Math.abs(pair.correlation)}
								{@const isPositive = pair.correlation >= 0}
								<div class="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-dark-bg/40 hover:bg-dark-bg/70 transition-colors">
									<div class="flex items-center gap-1.5 min-w-[140px]">
										<span class="text-sm font-medium text-white">{pair.symA}</span>
										<span class="text-gray-600 text-xs">↔</span>
										<span class="text-sm font-medium text-white">{pair.symB}</span>
									</div>
									<!-- Bar -->
									<div class="flex-1 h-2 bg-dark-border/40 rounded-full overflow-hidden">
										<div
											class="h-full rounded-full transition-all {absR >= 0.7 ? (isPositive ? 'bg-red-500' : 'bg-blue-500') : absR >= 0.4 ? (isPositive ? 'bg-amber-500' : 'bg-blue-400') : 'bg-gray-600'}"
											style="width: {absR * 100}%"
										></div>
									</div>
									<div class="flex items-center gap-2 min-w-[100px] justify-end">
										<span class="text-sm font-bold {absR >= 0.7 ? (isPositive ? 'text-red-400' : 'text-blue-400') : absR >= 0.4 ? 'text-amber-400' : 'text-gray-400'}">
											{pair.correlation >= 0 ? '+' : ''}{pair.correlation.toFixed(3)}
										</span>
										<span class="text-[10px] text-gray-600 whitespace-nowrap">{pair.sharedDays} วัน</span>
									</div>
									{#if absR >= 0.7 && isPositive}
										<div class="shrink-0 px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/20 text-[10px] text-red-400 font-medium">
											เสี่ยงสูง
										</div>
									{:else if absR >= 0.7 && !isPositive}
										<div class="shrink-0 px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/20 text-[10px] text-blue-400 font-medium">
											กระจายเสี่ยง
										</div>
									{/if}
								</div>
							{/each}
						</div>
						{#if correlationMatrix.topPairs.some(p => Math.abs(p.correlation) >= 0.7 && p.correlation >= 0)}
							<div class="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 flex gap-2 items-start">
								<svg class="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
								<p class="text-xs text-red-300">คำเตือน: มีคู่สกุลเงินที่มีความสัมพันธ์สูง หากเปิดทั้งสองพร้อมกัน ความเสี่ยงจะเพิ่มขึ้นเป็นสองเท่า</p>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

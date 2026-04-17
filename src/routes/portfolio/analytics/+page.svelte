<script lang="ts">
	import { navigating } from '$app/stores';
	import { page } from '$app/stores';
	import PortfolioFilterBar from '$lib/components/portfolio/PortfolioFilterBar.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import OverviewTab from '$lib/components/analytics/OverviewTab.svelte';
	import PerformanceTab from '$lib/components/analytics/PerformanceTab.svelte';
	import CalendarTab from '$lib/components/analytics/CalendarTab.svelte';
	import SymbolsTab from '$lib/components/analytics/SymbolsTab.svelte';
	import TagsTab from '$lib/components/analytics/TagsTab.svelte';
	import DaysTab from '$lib/components/analytics/DaysTab.svelte';
	import DaytimeTab from '$lib/components/analytics/DaytimeTab.svelte';
	import RiskTab from '$lib/components/analytics/RiskTab.svelte';
	import RecapsTab from '$lib/components/analytics/RecapsTab.svelte';
	import CompareTab from '$lib/components/analytics/CompareTab.svelte';
	import CorrelationTab from '$lib/components/analytics/CorrelationTab.svelte';
	import type { SymbolBreakdownItem, TagBreakdown, DayOfWeekReport } from '$lib/types';

	let { data } = $props();
	let { report, filterState, filterOptions, tags, playbooks, savedViews, symbolBreakdown: rawSymbolBreakdown, tagBreakdown: rawTagBreakdown, dayOfWeekReport: rawDayOfWeekReport, dayTimeHeatmap, calendarDays, kpiMetrics, statsOverview, healthScore, riskAnalysis, correlationMatrix } = $derived(data);
	const symbolBreakdown = $derived((rawSymbolBreakdown as SymbolBreakdownItem[]) || []);
	const tagBreakdown = $derived(rawTagBreakdown as TagBreakdown | null | undefined);
	const dayOfWeekReport = $derived(rawDayOfWeekReport as DayOfWeekReport | null | undefined);

	// Sub-tab state — local + URL sync
	let activeTab = $state($page.url.searchParams.get('tab') || 'overview');

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
		activeTab = tab;
	}

	let exportMenuOpen = $state(false);
	let exporting = $state(false);
	let exportingCsv = $state(false);

	function toggleExportMenu() {
		exportMenuOpen = !exportMenuOpen;
	}

	function closeExportMenu() {
		exportMenuOpen = false;
	}

	async function exportPdf() {
		closeExportMenu();
		exporting = true;
		try {
			const res = await fetch('/api/portfolio/reports/export-pdf', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filters: window.location.search })
			});
			if (!res.ok) return;
			const html = await res.text();
			const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const win = window.open(url, '_blank');
			if (win) win.onunload = () => URL.revokeObjectURL(url);
		} finally {
			exporting = false;
		}
	}

	async function exportCsv() {
		closeExportMenu();
		exportingCsv = true;
		try {
			const params = new URLSearchParams(window.location.search);
			params.delete('tab');
			const query = params.toString();
			const res = await fetch(`/api/portfolio/reports/export-csv${query ? `?${query}` : ''}`);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				alert(err.message || `Export failed (${res.status})`);
				return;
			}
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `analytics-trades-${new Date().toISOString().split('T')[0]}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} finally {
			exportingCsv = false;
		}
	}
</script>

<svelte:document
	onclick={(event) => {
		const target = event.target as HTMLElement | null;
		if (!target?.closest('[data-export-menu]')) closeExportMenu();
	}}
/>

<div class="space-y-7 relative">
	{#if $navigating}
		<div class="absolute inset-0 bg-dark-bg/50 flex items-center justify-center z-10 rounded-lg">
			<div class="animate-spin w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full"></div>
		</div>
	{/if}

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
		<div class="flex gap-1 bg-dark-surface/60 rounded-xl p-1 overflow-x-auto backdrop-blur-sm border border-gray-700/40 flex-1 min-w-0">
			{#each subTabs as tab}
				<button
					class="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap
						{activeTab === tab.key ? 'bg-dark-bg text-brand-primary shadow-md shadow-brand-primary/5 ring-1 ring-brand-primary/20' : 'text-gray-400 hover:text-gray-300 hover:bg-dark-bg/40'}"
					onclick={() => switchTab(tab.key)}
				>{tab.label}</button>
			{/each}
		</div>
		<div class="relative whitespace-nowrap" data-export-menu>
			<button
				type="button"
				onclick={toggleExportMenu}
				aria-haspopup="menu"
				aria-expanded={exportMenuOpen}
				class="flex items-center gap-2 rounded-lg border border-gray-700/50 px-3 py-2 text-xs text-gray-400 hover:text-white hover:border-brand-primary/40 transition-colors disabled:opacity-50"
				disabled={exporting || exportingCsv}
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
				{exporting ? 'กำลังส่งออก PDF...' : exportingCsv ? 'กำลังส่งออก CSV...' : 'ส่งออกข้อมูล'}
				<svg class="w-3.5 h-3.5 transition-transform duration-200 {exportMenuOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
			</button>

			{#if exportMenuOpen}
				<div class="absolute right-0 top-full z-20 mt-2 min-w-[11rem] overflow-hidden rounded-xl border border-gray-700/60 bg-dark-surface/95 p-1.5 shadow-xl backdrop-blur-md">
					<button
						type="button"
						role="menuitem"
						onclick={exportCsv}
						class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-300 transition-colors hover:bg-dark-bg/70 hover:text-white"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7h16M4 12h16M4 17h16"></path></svg>
						ส่งออก CSV
					</button>
					<button
						type="button"
						role="menuitem"
						onclick={exportPdf}
						class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-gray-300 transition-colors hover:bg-dark-bg/70 hover:text-white"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
						ส่งออก PDF
					</button>
				</div>
			{/if}
		</div>
	</div>

	{#if !report}
		<div class="card">
			<EmptyState message="ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์" />
		</div>

	{:else if activeTab === 'overview'}
		<OverviewTab {report} {statsOverview} />

	{:else if activeTab === 'performance'}
		<PerformanceTab {calendarDays} {kpiMetrics} {healthScore} />

	{:else if activeTab === 'calendar'}
		<CalendarTab {calendarDays} />

	{:else if activeTab === 'symbols'}
		<SymbolsTab {symbolBreakdown} />

	{:else if activeTab === 'tags'}
		<TagsTab {tagBreakdown} />

	{:else if activeTab === 'days'}
		<DaysTab {dayOfWeekReport} />

	{:else if activeTab === 'daytime'}
		<DaytimeTab {dayTimeHeatmap} />

	{:else if activeTab === 'risk'}
		<RiskTab {riskAnalysis} />

	{:else if activeTab === 'recaps'}
		<RecapsTab />

	{:else if activeTab === 'compare'}
		<CompareTab filteredTrades={report.filteredTrades} />

	{:else if activeTab === 'correlation'}
		<CorrelationTab {correlationMatrix} />
	{/if}
</div>

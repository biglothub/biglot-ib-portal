<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import AnalyticsDashboard from '$lib/components/portfolio/AnalyticsDashboard.svelte';
	import PortfolioFilterBar from '$lib/components/portfolio/PortfolioFilterBar.svelte';
	import CumulativePnlChart from '$lib/components/charts/CumulativePnlChart.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatNumber, formatPercent } from '$lib/utils';

	let { data } = $props();
	let { report, filterState, filterOptions, tags, playbooks, savedViews, symbolBreakdown, calendarDays, kpiMetrics } = $derived(data);

	// Sub-tab state from URL
	let activeTab = $derived($page.url.searchParams.get('tab') || 'overview');

	const subTabs = [
		{ key: 'overview', label: 'Overview' },
		{ key: 'performance', label: 'Performance' },
		{ key: 'calendar', label: 'Calendar' },
		{ key: 'symbols', label: 'Symbols' },
		{ key: 'compare', label: 'Compare' },
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

	// Available symbols for compare
	const availableSymbols = $derived([...new Set((report?.filteredTrades || []).map((t: any) => t.symbol))].sort());
</script>

<div class="space-y-6">
	<PortfolioFilterBar
		filters={filterState}
		{filterOptions}
		{tags}
		{playbooks}
		{savedViews}
		pageKey="analytics"
	/>

	<!-- Sub-tab navigation -->
	<div class="flex gap-1 bg-dark-surface rounded-lg p-1 overflow-x-auto">
		{#each subTabs as tab}
			<button
				class="px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap
					{activeTab === tab.key ? 'bg-dark-bg text-brand-primary shadow-sm' : 'text-gray-400 hover:text-gray-300'}"
				onclick={() => switchTab(tab.key)}
			>{tab.label}</button>
		{/each}
	</div>

	{#if !report}
		<div class="card">
			<EmptyState message="ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์" />
		</div>

	{:else if activeTab === 'overview'}
		<!-- OVERVIEW (existing analytics) -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="card">
				<div class="text-xs text-gray-500">Expectancy</div>
				<div class="mt-1 text-2xl font-semibold {report.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}">
					{formatCurrency(report.expectancy)}
				</div>
			</div>
			<div class="card">
				<div class="text-xs text-gray-500">Rule-break Cost</div>
				<div class="mt-1 text-2xl font-semibold text-red-400">{formatCurrency(report.ruleBreakMetrics?.ruleBreakLoss || 0)}</div>
			</div>
			<div class="card">
				<div class="text-xs text-gray-500">Journal Completion</div>
				<div class="mt-1 text-2xl font-semibold text-green-400">{(report.journalSummary?.completionRate || 0).toFixed(0)}%</div>
			</div>
			<div class="card">
				<div class="text-xs text-gray-500">Filtered Trades</div>
				<div class="mt-1 text-2xl font-semibold text-white">{report.filteredTrades?.length || 0}</div>
			</div>
		</div>

		{#if report.analytics}
			<AnalyticsDashboard analytics={report.analytics} />
		{/if}

		<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
			<div class="card">
				<h2 class="text-sm font-medium text-gray-400 mb-4">Setup / Playbook Performance</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left py-2">Setup</th>
								<th class="text-right py-2">Trades</th>
								<th class="text-right py-2">Win Rate</th>
								<th class="text-right py-2">PF</th>
								<th class="text-right py-2">Expectancy</th>
								<th class="text-right py-2">Total P/L</th>
							</tr>
						</thead>
						<tbody>
							{#each report.setupPerformance || [] as setup}
								<tr class="border-b border-dark-border/40">
									<td class="py-2 text-white">{setup.name}</td>
									<td class="py-2 text-right text-gray-300">{setup.totalTrades}</td>
									<td class="py-2 text-right {setup.winRate >= 50 ? 'text-green-400' : 'text-red-400'}">{formatPercent(setup.winRate).replace('+', '')}</td>
									<td class="py-2 text-right {setup.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{setup.profitFactor === Infinity ? '∞' : formatNumber(setup.profitFactor)}</td>
									<td class="py-2 text-right {setup.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(setup.expectancy)}</td>
									<td class="py-2 text-right font-medium {setup.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(setup.totalProfit)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="card">
				<h2 class="text-sm font-medium text-gray-400 mb-4">Session Breakdown</h2>
				<div class="space-y-3">
					{#each report.sessionStats || [] as session}
						<div class="rounded-xl bg-dark-bg/30 px-4 py-3">
							<div class="flex items-center justify-between">
								<span class="text-white uppercase">{session.session}</span>
								<span class="{session.profit >= 0 ? 'text-green-400' : 'text-red-400'} font-medium">{formatCurrency(session.profit)}</span>
							</div>
							<div class="mt-1 text-xs text-gray-500">{session.trades} trades • {session.winRate.toFixed(0)}% win</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
			<div class="card xl:col-span-1">
				<h2 class="text-sm font-medium text-gray-400 mb-4">Mistake Cost</h2>
				<div class="space-y-2">
					{#if report.mistakeStats?.length > 0}
						{#each report.mistakeStats.slice(0, 8) as mistake}
							<div class="flex items-center justify-between rounded-xl bg-dark-bg/30 px-3 py-3">
								<div>
									<div class="text-sm text-white">{mistake.name}</div>
									<div class="text-[11px] text-gray-500">{mistake.count} tagged trades</div>
								</div>
								<div class="text-sm font-medium text-red-400">{formatCurrency(mistake.cost)}</div>
							</div>
						{/each}
					{:else}
						<EmptyState message="ยังไม่มี mistake tags ใน filtered trades" />
					{/if}
				</div>
			</div>
			<div class="card xl:col-span-1">
				<h2 class="text-sm font-medium text-gray-400 mb-4">Duration Buckets</h2>
				<div class="space-y-2">
					{#each report.durationBuckets || [] as bucket}
						<div class="rounded-xl bg-dark-bg/30 px-3 py-3">
							<div class="flex items-center justify-between">
								<div class="text-sm text-white uppercase">{bucket.bucket}</div>
								<div class="{bucket.profit >= 0 ? 'text-green-400' : 'text-red-400'} text-sm font-medium">{formatCurrency(bucket.profit)}</div>
							</div>
							<div class="mt-1 text-[11px] text-gray-500">{bucket.count} trades • avg {bucket.avgMinutes} min</div>
						</div>
					{/each}
				</div>
			</div>
			<div class="card xl:col-span-1">
				<h2 class="text-sm font-medium text-gray-400 mb-4">Progress Goals</h2>
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
		<!-- PERFORMANCE VIEW -->
		<div class="card">
			<h2 class="text-lg font-semibold text-white mb-4">Performance</h2>
			{#if kpiMetrics?.cumulativePnl && kpiMetrics.cumulativePnl.length > 1}
				<CumulativePnlChart data={kpiMetrics.cumulativePnl} height={300} />
			{:else}
				<EmptyState message="ไม่มีข้อมูลเพียงพอสำหรับแสดง chart" />
			{/if}
		</div>

		<!-- Summary stats -->
		{#if kpiMetrics}
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<div class="card">
					<div class="text-xs text-gray-500">Net P&L</div>
					<div class="mt-1 text-2xl font-bold {kpiMetrics.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(kpiMetrics.netPnl)}</div>
				</div>
				<div class="card">
					<div class="text-xs text-gray-500">Trade Win Rate</div>
					<div class="mt-1 text-2xl font-bold {kpiMetrics.tradeWinRate >= 50 ? 'text-green-400' : 'text-amber-400'}">{kpiMetrics.tradeWinRate.toFixed(1)}%</div>
				</div>
				<div class="card">
					<div class="text-xs text-gray-500">Profit Factor</div>
					<div class="mt-1 text-2xl font-bold {kpiMetrics.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{kpiMetrics.profitFactor >= 999 ? '∞' : formatNumber(kpiMetrics.profitFactor)}</div>
				</div>
				<div class="card">
					<div class="text-xs text-gray-500">Day Win Rate</div>
					<div class="mt-1 text-2xl font-bold {kpiMetrics.dayWinRate >= 50 ? 'text-green-400' : 'text-amber-400'}">{kpiMetrics.dayWinRate.toFixed(1)}%</div>
				</div>
			</div>
		{/if}

	{:else if activeTab === 'calendar'}
		<!-- CALENDAR YEAR VIEW -->
		<div class="card">
			<div class="flex items-center justify-between mb-6">
				<button onclick={() => calendarYear--} class="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-bg/50">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
				</button>
				<h2 class="text-xl font-bold text-white">{calendarYear}</h2>
				<button onclick={() => calendarYear++} class="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-bg/50">
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
										title={cell.trades > 0 ? `${cell.date}: ${formatCurrency(cell.pnl)} (${cell.trades} trades)` : cell.date}
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
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-green-500/30"></div> Profit</div>
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-red-500/30"></div> Loss</div>
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-dark-bg"></div> No trades</div>
			</div>
		</div>

	{:else if activeTab === 'symbols'}
		<!-- SYMBOLS BREAKDOWN -->
		<div class="card">
			<h2 class="text-lg font-semibold text-white mb-4">Symbol Performance</h2>
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
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left py-2">Symbol</th>
								{#each [
									{ key: 'trades', label: 'Trades' },
									{ key: 'winRate', label: 'Win Rate' },
									{ key: 'profitFactor', label: 'PF' },
									{ key: 'netPnl', label: 'Net P&L' },
									{ key: 'avgPnl', label: 'Avg P&L' },
								] as col}
									<th class="text-right py-2 cursor-pointer hover:text-gray-300 select-none" onclick={() => toggleSort(col.key)}>
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

	{:else if activeTab === 'compare'}
		<!-- COMPARE TOOL -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<div class="card">
				<h3 class="text-sm font-semibold text-white mb-4">Group #1</h3>
				<div class="space-y-3">
					<div>
						<label class="text-xs text-gray-500">Symbol</label>
						<select bind:value={group1Symbol} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
							<option value="">All symbols</option>
							{#each availableSymbols as sym}
								<option value={sym}>{sym}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="text-xs text-gray-500">Side</label>
						<select bind:value={group1Side} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
							<option value="">All sides</option>
							<option value="BUY">BUY</option>
							<option value="SELL">SELL</option>
						</select>
					</div>
				</div>
			</div>
			<div class="card">
				<h3 class="text-sm font-semibold text-white mb-4">Group #2</h3>
				<div class="space-y-3">
					<div>
						<label class="text-xs text-gray-500">Symbol</label>
						<select bind:value={group2Symbol} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
							<option value="">All symbols</option>
							{#each availableSymbols as sym}
								<option value={sym}>{sym}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="text-xs text-gray-500">Side</label>
						<select bind:value={group2Side} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
							<option value="">All sides</option>
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
			>Reset</button>
			<button
				onclick={generateCompare}
				class="px-6 py-2 rounded-lg bg-brand-primary text-dark-bg text-sm font-semibold hover:opacity-90"
			>Generate Report</button>
		</div>

		{#if compareResult}
			<div class="card">
				<h3 class="text-sm font-semibold text-white mb-4">Comparison Results</h3>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left py-2">Metric</th>
								<th class="text-right py-2">Group #1</th>
								<th class="text-right py-2">Group #2</th>
								<th class="text-right py-2">Diff</th>
							</tr>
						</thead>
						<tbody>
							{#each [
								{ label: 'Trades', g1: compareResult.group1.trades, g2: compareResult.group2.trades, fmt: 'num' },
								{ label: 'Win Rate', g1: compareResult.group1.winRate, g2: compareResult.group2.winRate, fmt: 'pct' },
								{ label: 'Profit Factor', g1: compareResult.group1.profitFactor, g2: compareResult.group2.profitFactor, fmt: 'num' },
								{ label: 'Net P&L', g1: compareResult.group1.netPnl, g2: compareResult.group2.netPnl, fmt: 'cur' },
								{ label: 'Avg P&L', g1: compareResult.group1.avgPnl, g2: compareResult.group2.avgPnl, fmt: 'cur' },
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
	{/if}
</div>

<script lang="ts">
	import AnalyticsDashboard from '$lib/components/portfolio/AnalyticsDashboard.svelte';
	import PortfolioFilterBar from '$lib/components/portfolio/PortfolioFilterBar.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatNumber, formatPercent } from '$lib/utils';

	let { data } = $props();
	let { report, filterState, filterOptions, tags, playbooks, savedViews } = $derived(data);
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

	{#if !report}
		<div class="card">
			<EmptyState message="ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์" />
		</div>
	{:else}
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
									<td class="py-2 text-right {setup.winRate >= 50 ? 'text-green-400' : 'text-red-400'}">
										{formatPercent(setup.winRate).replace('+', '')}
									</td>
									<td class="py-2 text-right {setup.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">
										{setup.profitFactor === Infinity ? '∞' : formatNumber(setup.profitFactor)}
									</td>
									<td class="py-2 text-right {setup.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(setup.expectancy)}
									</td>
									<td class="py-2 text-right font-medium {setup.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(setup.totalProfit)}
									</td>
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
	{/if}
</div>

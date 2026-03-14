<script lang="ts">
	import AnalyticsDashboard from '$lib/components/portfolio/AnalyticsDashboard.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatNumber, formatPercent } from '$lib/utils';

	let { data } = $props();
	let { analytics, strategyReport, tradingScore, runningPnL } = $derived(data);

	const maxAbsPnL = $derived(runningPnL?.length > 0 ? Math.max(...runningPnL.map((r: any) => Math.abs(r.cumulative)), 1) : 1);
	const displayTrades = $derived(
		runningPnL?.length > 100
			? runningPnL.filter((_: any, i: number) => i % Math.ceil(runningPnL.length / 100) === 0)
			: (runningPnL || [])
	);
</script>

<div class="space-y-6">
	{#if !analytics && !tradingScore}
		<div class="card">
			<EmptyState message="ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์" />
		</div>
	{:else}
		<!-- Trading Score -->
		{#if tradingScore}
			<div class="card">
				<h2 class="text-sm font-medium text-gray-400 mb-4">Trading Score</h2>
				<div class="flex items-center gap-8">
					<!-- Score Circle -->
					<div class="relative w-32 h-32 flex-shrink-0">
						<svg class="w-full h-full -rotate-90" viewBox="0 0 120 120">
							<circle
								cx="60" cy="60" r="52"
								fill="none"
								stroke="currentColor"
								stroke-width="8"
								class="text-dark-border"
							/>
							<circle
								cx="60" cy="60" r="52"
								fill="none"
								stroke-width="8"
								stroke-linecap="round"
								stroke-dasharray="{(tradingScore.total / 100) * 326.73} 326.73"
								class="{tradingScore.total >= 70 ? 'text-green-400' : tradingScore.total >= 40 ? 'text-yellow-400' : 'text-red-400'}"
							/>
						</svg>
						<div class="absolute inset-0 flex flex-col items-center justify-center">
							<span class="text-3xl font-bold text-white">{tradingScore.total}</span>
							<span class="text-[10px] text-gray-500">/ 100</span>
						</div>
					</div>

					<!-- Breakdown -->
					<div class="flex-1 space-y-3">
						{#each [
							{ label: 'Performance', score: tradingScore.performance, max: 25, color: 'bg-blue-500' },
							{ label: 'Risk Management', score: tradingScore.risk, max: 25, color: 'bg-green-500' },
							{ label: 'Consistency', score: tradingScore.consistency, max: 25, color: 'bg-yellow-500' },
							{ label: 'Discipline', score: tradingScore.discipline, max: 25, color: 'bg-purple-500' },
						] as cat}
							<div>
								<div class="flex items-center justify-between text-xs mb-1">
									<span class="text-gray-400">{cat.label}</span>
									<span class="text-white">{cat.score}/{cat.max}</span>
								</div>
								<div class="w-full bg-dark-border rounded-full h-1.5">
									<div class="{cat.color} rounded-full h-1.5 transition-all" style="width: {(cat.score / cat.max) * 100}%"></div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Strategy Report -->
		{#if strategyReport.length > 0}
			<div class="card">
				<h2 class="text-sm font-medium text-gray-400 mb-4">Strategy Performance</h2>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left py-2">Strategy</th>
								<th class="text-right py-2">Trades</th>
								<th class="text-right py-2">Win Rate</th>
								<th class="text-right py-2">PF</th>
								<th class="text-right py-2">Avg Win</th>
								<th class="text-right py-2">Avg Loss</th>
								<th class="text-right py-2">Expectancy</th>
								<th class="text-right py-2">Total P/L</th>
							</tr>
						</thead>
						<tbody>
							{#each strategyReport as strategy}
								<tr class="border-b border-dark-border/50">
									<td class="py-2">
										<span class="flex items-center gap-2">
											<span class="w-2.5 h-2.5 rounded-full" style="background-color: {strategy.color}"></span>
											<span class="text-white">{strategy.name}</span>
										</span>
									</td>
									<td class="py-2 text-right text-gray-300">{strategy.totalTrades}</td>
									<td class="py-2 text-right {strategy.winRate >= 50 ? 'text-green-400' : 'text-red-400'}">
										{formatPercent(strategy.winRate).replace('+', '')}
									</td>
									<td class="py-2 text-right {strategy.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">
										{strategy.profitFactor === Infinity ? '∞' : formatNumber(strategy.profitFactor)}
									</td>
									<td class="py-2 text-right text-green-400">{formatCurrency(strategy.avgWin)}</td>
									<td class="py-2 text-right text-red-400">{formatCurrency(strategy.avgLoss)}</td>
									<td class="py-2 text-right {strategy.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(strategy.expectancy)}
									</td>
									<td class="py-2 text-right font-medium {strategy.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(strategy.totalProfit)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Running P/L -->
		{#if runningPnL.length > 0}
			<div class="card">
				<h2 class="text-sm font-medium text-gray-400 mb-4">Running P/L (Trade-by-Trade)</h2>
				<div class="h-48 flex items-end gap-px">
					{#each displayTrades as point}
						<div
							class="flex-1 min-w-[2px] rounded-t transition-all
								{point.cumulative >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'}"
							style="height: {Math.max(Math.abs(point.cumulative) / maxAbsPnL * 100, 2)}%;"
							title="{formatCurrency(point.cumulative)}"
						></div>
					{/each}
				</div>
				<div class="flex justify-between mt-2 text-[10px] text-gray-500">
					<span>Trade #1</span>
					<span class="{runningPnL[runningPnL.length - 1]?.cumulative >= 0 ? 'text-green-400' : 'text-red-400'} text-xs font-medium">
						{formatCurrency(runningPnL[runningPnL.length - 1]?.cumulative || 0)}
					</span>
					<span>Trade #{runningPnL.length}</span>
				</div>
			</div>
		{/if}

		<!-- Standard Analytics -->
		{#if analytics}
			<AnalyticsDashboard {analytics} />
		{/if}
	{/if}
</div>

<script lang="ts">
	import HealthScoreCard from '$lib/components/portfolio/HealthScoreCard.svelte';
	import { formatCurrency, formatNumber } from '$lib/utils';
	import type { Component } from 'svelte';

	let { calendarDays, kpiMetrics, healthScore } = $props<{
		calendarDays: Array<{ date: string; pnl: number; trades: number }> | null | undefined;
		kpiMetrics: ReturnType<typeof import('$lib/server/portfolio').buildKpiMetrics> | null | undefined;
		healthScore: { score: number } | null | undefined;
	}>();

	let ConfigurableMetricChart = $state<Component | null>(null);
	$effect(() => {
		if (!ConfigurableMetricChart) {
			import('$lib/components/charts/ConfigurableMetricChart.svelte').then(m => {
				ConfigurableMetricChart = m.default;
			});
		}
	});
</script>

<!-- PERFORMANCE VIEW — Dual Configurable Charts -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
	<div class="card">
		{#if ConfigurableMetricChart}
			<ConfigurableMetricChart
				dailyHistory={calendarDays?.map((d: { date: string; pnl: number; trades: number }) => ({ date: d.date, profit: d.pnl, totalTrades: d.trades })) || []}
				defaultMetric="net_pnl_cumulative"
				defaultTimeframe="day"
				height={280}
			/>
		{:else}
			<div class="animate-pulse space-y-3">
				<div class="h-4 bg-dark-border/50 rounded w-1/3"></div>
				<div class="h-[280px] bg-dark-border/20 rounded-lg"></div>
			</div>
		{/if}
	</div>
	<div class="card">
		{#if ConfigurableMetricChart}
			<ConfigurableMetricChart
				dailyHistory={calendarDays?.map((d: { date: string; pnl: number; trades: number }) => ({ date: d.date, profit: d.pnl, totalTrades: d.trades })) || []}
				defaultMetric="win_rate"
				defaultTimeframe="day"
				height={280}
			/>
		{:else}
			<div class="animate-pulse space-y-3">
				<div class="h-4 bg-dark-border/50 rounded w-1/3"></div>
				<div class="h-[280px] bg-dark-border/20 rounded-lg"></div>
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

<script lang="ts">
	import MetricCard from '$lib/components/shared/MetricCard.svelte';
	import DaySparkline from '$lib/components/charts/DaySparkline.svelte';
	import { formatCurrency, formatNumber, formatPercent } from '$lib/utils';

	let { kpiMetrics }: {
		kpiMetrics: {
			netPnl: number;
			totalTrades: number;
			winningTrades: number;
			losingTrades: number;
			tradeWinRate: number;
			profitFactor: number;
			avgWin: number;
			avgLoss: number;
			avgWinLossRatio: number;
			cumulativePnl: Array<{ date: string; value: number }>;
		};
	} = $props();

	let sparklineData = $derived(
		(kpiMetrics.cumulativePnl || []).map((d, i) => ({ time: i, value: d.value }))
	);
</script>

<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
	<!-- Card 1: Net Cumulative P&L with sparkline -->
	<div class="card col-span-2 lg:col-span-1">
		<div class="flex items-center gap-2 mb-1">
			<span class="text-xs text-gray-400">กำไร/ขาดทุนสุทธิสะสม</span>
			<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-dark-bg text-gray-300 font-medium">
				{kpiMetrics.totalTrades}
			</span>
		</div>
		<div class="text-2xl font-bold {kpiMetrics.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">
			{formatCurrency(kpiMetrics.netPnl)}
		</div>
		{#if sparklineData.length >= 2}
			<div class="mt-2">
				<DaySparkline data={sparklineData} height={48} />
			</div>
		{/if}
	</div>

	<!-- Card 2: Profit Factor -->
	<MetricCard
		label="อัตราส่วนกำไร"
		value={formatNumber(kpiMetrics.profitFactor, 2)}
		color={kpiMetrics.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}
		gaugeValue={kpiMetrics.profitFactor}
		gaugeMax={3}
	/>

	<!-- Card 3: Trade Win % -->
	<MetricCard
		label="อัตราชนะ (เทรด)"
		value="{kpiMetrics.tradeWinRate.toFixed(1)}%"
		color={kpiMetrics.tradeWinRate >= 50 ? 'text-green-400' : 'text-amber-400'}
		donutPercent={kpiMetrics.tradeWinRate}
		tradeCount={{ wins: kpiMetrics.winningTrades, losses: kpiMetrics.losingTrades }}
	/>

	<!-- Card 4: Avg Win/Loss -->
	<MetricCard
		label="ค่าเฉลี่ย ชนะ/แพ้"
		value={formatNumber(kpiMetrics.avgWinLossRatio, 2)}
		color={kpiMetrics.avgWinLossRatio >= 1 ? 'text-green-400' : 'text-red-400'}
		barData={{
			left: { value: formatCurrency(kpiMetrics.avgWin), color: 'bg-green-500' },
			right: { value: formatCurrency(kpiMetrics.avgLoss), color: 'bg-red-500' }
		}}
	/>
</div>

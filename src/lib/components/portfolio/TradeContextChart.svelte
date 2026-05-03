<script lang="ts">
	import { onMount } from 'svelte';
	import { formatCurrency, formatNumber } from '$lib/utils';
	import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
	import type { Trade, TradeChartContext, TradeChartBar } from '$lib/types';

	let {
		contexts = [],
		trade
	}: {
		contexts?: TradeChartContext[];
		trade?: Trade;
	} = $props();

	let container = $state<HTMLDivElement>(undefined!);
	let chart: IChartApi | null;
	let series: ISeriesApi<'Candlestick'> | null;
	let selectedTimeframe = $state('M5');
	let availableTimeframes = $derived(
		(contexts || []).map((context: TradeChartContext) => context.timeframe)
	);
	let currentContext = $derived(
		(contexts || []).find((context: TradeChartContext) => context.timeframe === selectedTimeframe) || contexts?.[0] || null
	);

	function renderChart() {
		if (!chart || !series || !currentContext || !trade) return;
		const bars = (currentContext.bars || []).map((bar: TradeChartBar) => ({
			time: bar.time as unknown as Time,
			open: bar.open,
			high: bar.high,
			low: bar.low,
			close: bar.close
		}));
		series.setData(bars);
		series.setMarkers([
			{
				time: Math.floor(new Date(trade.open_time).getTime() / 1000) as unknown as Time,
				position: 'belowBar',
				color: '#22c55e',
				shape: 'arrowUp',
				text: `Entry ${formatNumber(trade.open_price, 5)}`
			},
			{
				time: Math.floor(new Date(trade.close_time).getTime() / 1000) as unknown as Time,
				position: 'aboveBar',
				color: '#f97316',
				shape: 'arrowDown',
				text: `Exit ${formatNumber(trade.close_price, 5)}`
			}
		]);

		if (trade.sl) {
			series.createPriceLine({
				price: Number(trade.sl),
				color: '#ef4444',
				lineWidth: 1,
				lineStyle: 2,
				axisLabelVisible: true,
				title: 'SL'
			});
		}
		if (trade.tp) {
			series.createPriceLine({
				price: Number(trade.tp),
				color: '#22c55e',
				lineWidth: 1,
				lineStyle: 2,
				axisLabelVisible: true,
				title: 'TP'
			});
		}
		chart.timeScale().fitContent();
	}

	onMount(() => {
		let observer: ResizeObserver | undefined;
		let destroyed = false;

		import('lightweight-charts').then(({ createChart, ColorType }) => {
			if (destroyed || !container) return;

			chart = createChart(container, {
				layout: {
					background: { type: ColorType.Solid, color: 'transparent' },
					textColor: '#b8ad94',
					fontFamily: "'Inter', sans-serif"
				},
				grid: {
					vertLines: { color: 'rgba(245, 241, 227, 0.08)' },
					horzLines: { color: 'rgba(245, 241, 227, 0.08)' }
				},
				width: container.clientWidth,
				height: 320,
				timeScale: {
					timeVisible: true,
					secondsVisible: false,
					borderColor: 'rgba(245, 241, 227, 0.08)'
				},
				rightPriceScale: {
					borderColor: 'rgba(245, 241, 227, 0.08)'
				}
			});

			series = chart.addCandlestickSeries({
				upColor: '#22c55e',
				borderUpColor: '#22c55e',
				wickUpColor: '#22c55e',
				downColor: '#ef4444',
				borderDownColor: '#ef4444',
				wickDownColor: '#ef4444'
			});

			observer = new ResizeObserver(() => {
				chart?.applyOptions({ width: container.clientWidth });
			});
			observer.observe(container);
			renderChart();
		});

		return () => {
			destroyed = true;
			observer?.disconnect();
			chart?.remove();
		};
	});

	$effect(() => {
		if (currentContext?.timeframe) {
			selectedTimeframe = currentContext.timeframe;
			renderChart();
		}
	});
</script>

<div class="card space-y-4">
	<div class="flex items-start justify-between gap-3">
		<div>
			<h3 class="text-sm font-medium text-white">Trade Context</h3>
			<p class="text-xs text-gray-400">Entry/exit markers with synced bars around this trade.</p>
		</div>
		{#if availableTimeframes.length > 0}
			<select
				bind:value={selectedTimeframe}
				class="bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-sm text-white"
			>
				{#each availableTimeframes as timeframe}
					<option value={timeframe}>{timeframe}</option>
				{/each}
			</select>
		{/if}
	</div>

	{#if currentContext}
		<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3 text-xs text-gray-400">
			<div class="flex flex-wrap gap-4">
				<span>Window: {new Date(currentContext.window_start).toLocaleString('th-TH')}</span>
				<span>{new Date(currentContext.window_end).toLocaleString('th-TH')}</span>
				<span>P/L: <span class={(trade?.profit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>{formatCurrency(trade?.profit ?? 0)}</span></span>
			</div>
		</div>
		<div bind:this={container} class="w-full"></div>
	{:else}
		<div class="rounded-xl border border-dashed border-dark-border px-4 py-6 text-center text-sm text-gray-400">
			ยังไม่มี chart context สำหรับ trade นี้
		</div>
	{/if}
</div>

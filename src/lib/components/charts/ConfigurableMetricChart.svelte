<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { formatCurrency, formatNumber } from '$lib/utils';
	import { buildPerformanceMetricSeries, makeCumulative, AVAILABLE_METRICS } from '$lib/performance-metrics';
	import type { IChartApi, ISeriesApi, MouseEventParams } from 'lightweight-charts';

	let {
		dailyHistory = [],
		height = 260,
		defaultMetric = 'net_pnl_cumulative',
		defaultTimeframe = 'day',
		loading = false
	}: {
		dailyHistory?: Array<{ date: string; profit: number; totalTrades: number }>;
		height?: number;
		defaultMetric?: string;
		defaultTimeframe?: string;
		loading?: boolean;
	} = $props();

	let chartContainer = $state<HTMLDivElement>(undefined!);
	let chart: IChartApi | null;
	let series: ISeriesApi<'Histogram'> | ISeriesApi<'Area'> | null;
	// untrack() snapshots the initial prop value without creating a reactive dependency
	let selectedMetric = $state<string>(untrack(() => defaultMetric));
	let selectedTimeframe = $state<string>(untrack(() => defaultTimeframe));

	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipData = $state<any>(null);

	const timeframes = [
		{ key: 'day', label: 'D' },
		{ key: 'week', label: 'W' },
		{ key: 'month', label: 'M' }
	];

	const metricConfig = $derived(AVAILABLE_METRICS.find(m => m.key === selectedMetric) || AVAILABLE_METRICS[0]);

	const chartData = $derived.by(() => {
		if (!dailyHistory || dailyHistory.length === 0) return [];
		let data = buildPerformanceMetricSeries(dailyHistory, selectedMetric as any, selectedTimeframe as any);
		if (selectedMetric === 'net_pnl_cumulative') {
			data = makeCumulative(buildPerformanceMetricSeries(dailyHistory, 'net_pnl', selectedTimeframe as any));
		}
		return data;
	});

	function updateChart() {
		if (!chart || !chartContainer) return;

		// Remove old series
		if (series) {
			try { chart.removeSeries(series); } catch { /* ignore */ }
		}

		if (chartData.length === 0) return;

		const isHistogram = metricConfig.chartType === 'histogram';

		if (isHistogram) {
			series = chart.addHistogramSeries({
				priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
			});
			series.setData(chartData.map(d => ({
				time: d.date as any,
				value: d.value,
				color: d.value >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
			})));
		} else {
			series = chart.addAreaSeries({
				lineColor: '#C9A84C',
				topColor: 'rgba(201, 168, 76, 0.3)',
				bottomColor: 'rgba(201, 168, 76, 0.02)',
				lineWidth: 2,
				priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
				crosshairMarkerVisible: true,
				crosshairMarkerRadius: 4,
				crosshairMarkerBackgroundColor: '#C9A84C'
			});
			series.setData(chartData.map(d => ({ time: d.date as any, value: d.value })));
		}

		chart.timeScale().fitContent();
	}

	onMount(() => {
		let resizeObserver: ResizeObserver | undefined;
		let destroyed = false;

		const intersectionObserver = new IntersectionObserver((entries) => {
			if (!entries[0].isIntersecting) return;
			intersectionObserver.disconnect();

			import('lightweight-charts').then((lc) => {
				if (destroyed || !chartContainer) return;
				const { createChart, ColorType, LineStyle } = lc;

				chart = createChart(chartContainer, {
					layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#b8ad94', fontFamily: "'Inter', sans-serif" },
					grid: { vertLines: { color: 'rgba(245, 241, 227, 0.08)', style: LineStyle.Dotted }, horzLines: { color: 'rgba(245, 241, 227, 0.08)', style: LineStyle.Dotted } },
					width: chartContainer.clientWidth,
					height,
					rightPriceScale: { borderColor: 'rgba(245, 241, 227, 0.10)', scaleMargins: { top: 0.1, bottom: 0.1 } },
					timeScale: { borderColor: 'rgba(245, 241, 227, 0.10)', timeVisible: false, rightOffset: 3 },
					crosshair: { mode: 1, vertLine: { color: 'rgba(201, 168, 76, 0.5)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1F2937' }, horzLine: { color: 'rgba(201, 168, 76, 0.5)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1F2937' } },
					handleScroll: { mouseWheel: true, pressedMouseMove: true },
					handleScale: { mouseWheel: true, pinch: true }
				});

				chart.subscribeCrosshairMove((param: MouseEventParams) => {
					if (!param || !param.time || !param.point || !series) { tooltipVisible = false; return; }
					const val = param.seriesData.get(series) as { value?: number } | undefined;
					if (val && val.value !== undefined) {
						tooltipVisible = true;
						tooltipX = param.point.x;
						tooltipY = param.point.y;
						tooltipData = { date: param.time, value: val.value };
					}
				});

				resizeObserver = new ResizeObserver(() => { chart?.applyOptions({ width: chartContainer.clientWidth }); });
				resizeObserver.observe(chartContainer);
				updateChart();
			});
		}, { threshold: 0.05 });

		intersectionObserver.observe(chartContainer);

		return () => { destroyed = true; intersectionObserver.disconnect(); resizeObserver?.disconnect(); chart?.remove(); chart = null; };
	});

	$effect(() => {
		if (selectedMetric || selectedTimeframe || dailyHistory) {
			updateChart();
		}
	});

	function formatTooltipValue(value: number) {
		if (selectedMetric.includes('pnl') || selectedMetric === 'avg_win_loss') return formatCurrency(value);
		if (selectedMetric === 'win_rate') return `${value.toFixed(1)}%`;
		if (selectedMetric === 'trade_count') return String(Math.round(value));
		return formatNumber(value);
	}
</script>

<div class="w-full" aria-busy={loading} aria-label="ตัวชี้วัดประสิทธิภาพ">
	{#if loading}
		<div class="animate-pulse">
			<div class="flex items-center gap-2 mb-3">
				<div class="h-8 w-36 bg-dark-surface rounded-lg"></div>
				<div class="h-8 w-20 bg-dark-surface rounded-lg"></div>
			</div>
			<div class="bg-dark-surface rounded-lg overflow-hidden" style:height="{height}px">
				<div class="h-full w-full flex flex-col justify-end px-4 pb-4 gap-3">
					<div class="flex items-end gap-1 h-3/4">
						{#each [0.5, 0.7, 0.45, 0.85, 0.6, 0.95, 0.75, 0.55, 0.9, 0.65, 0.8, 0.7] as pct}
							<div class="flex-1 bg-gray-700/40 rounded-t" style:height="{pct * 100}%"></div>
						{/each}
					</div>
					<div class="h-3 w-full bg-gray-700/30 rounded"></div>
				</div>
			</div>
		</div>
	{:else}
	<div class="flex items-center gap-2 mb-3 flex-wrap">
		<!-- Metric selector -->
		<select
			bind:value={selectedMetric}
			class="rounded-lg bg-dark-bg border border-dark-border px-2 py-1.5 text-xs text-white min-w-[140px]"
		>
			{#each AVAILABLE_METRICS as m}
				<option value={m.key}>{m.label}</option>
			{/each}
		</select>

		<!-- Timeframe toggle -->
		<div class="flex gap-0.5 bg-dark-bg/50 rounded-lg p-0.5">
			{#each timeframes as tf}
				<button
					class="px-2.5 py-1 text-xs font-medium rounded-md transition-all
						{selectedTimeframe === tf.key ? 'bg-dark-surface text-brand-primary shadow-sm' : 'text-gray-400 hover:text-gray-300'}"
					onclick={() => { selectedTimeframe = tf.key; }}
				>{tf.label}</button>
			{/each}
		</div>
	</div>

	<div class="relative">
		<div bind:this={chartContainer} class="w-full rounded-lg overflow-hidden" style="height: {height}px"></div>

		{#if tooltipVisible && tooltipData}
			<div
				class="absolute pointer-events-none z-50 bg-gray-900/95 text-white text-xs rounded-xl py-2.5 px-3.5 shadow-xl backdrop-blur-sm border border-gray-700/50"
				style="left: {Math.min(tooltipX + 15, (chartContainer?.clientWidth || 0) - 150)}px; top: {Math.max(tooltipY - 50, 10)}px;"
			>
				<div class="text-gray-400 text-[10px] mb-1">{tooltipData.date}</div>
				<div class="font-mono font-semibold {tooltipData.value >= 0 ? 'text-green-400' : 'text-red-400'}">
					{formatTooltipValue(tooltipData.value)}
				</div>
			</div>
		{/if}

		{#if chartData.length === 0}
			<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">ไม่มีข้อมูลสำหรับตัวชี้วัดนี้</div>
		{/if}
	</div>
	{/if}
</div>

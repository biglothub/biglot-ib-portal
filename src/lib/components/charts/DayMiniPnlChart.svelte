<script lang="ts">
	import { onMount } from 'svelte';
	import { formatCurrency } from '$lib/utils';
	import type { IChartApi, ISeriesApi, MouseEventParams } from 'lightweight-charts';

	let {
		data = [],
		height = 150
	}: {
		data?: Array<{ time: number; value: number }>;
		height?: number;
	} = $props();

	let chartContainer = $state<HTMLDivElement>(undefined!);
	let chart: IChartApi | null;
	let areaSeries: ISeriesApi<'Area'> | null;
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipValue = $state(0);

	function updateChartData(chartData: Array<{ time: number; value: number }>) {
		if (!areaSeries || !chart || !chartData || chartData.length === 0) return;

		const lastValue = chartData[chartData.length - 1]?.value || 0;
		const lineColor = lastValue >= 0 ? '#22c55e' : '#ef4444';
		const topColor = lastValue >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';

		areaSeries.applyOptions({
			lineColor,
			topColor,
			crosshairMarkerBackgroundColor: lineColor
		});
		areaSeries.setData(chartData.map(d => ({ ...d, time: d.time as unknown as import('lightweight-charts').Time })));
		chart.timeScale().fitContent();
	}

	onMount(() => {
		let observer: ResizeObserver | undefined;
		let destroyed = false;

		import('lightweight-charts').then((lc) => {
			if (destroyed || !chartContainer) return;
			const { createChart, ColorType, LineStyle } = lc;

			chart = createChart(chartContainer, {
				layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9CA3AF', fontFamily: "'Inter', sans-serif" },
				grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(55, 65, 81, 0.2)', style: LineStyle.Dotted } },
				width: chartContainer.clientWidth,
				height,
				rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
				timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
				crosshair: { mode: 1, vertLine: { color: 'rgba(201, 168, 76, 0.4)', width: 1, style: LineStyle.Dashed, labelVisible: false }, horzLine: { color: 'rgba(201, 168, 76, 0.4)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1F2937' } },
				handleScroll: false,
				handleScale: false
			});

			areaSeries = chart.addAreaSeries({
				lineColor: '#22c55e',
				topColor: 'rgba(34, 197, 94, 0.3)',
				bottomColor: 'rgba(0,0,0,0)',
				lineWidth: 2,
				priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
				crosshairMarkerVisible: true,
				crosshairMarkerRadius: 3,
				crosshairMarkerBackgroundColor: '#22c55e'
			});

			chart.subscribeCrosshairMove((param: MouseEventParams) => {
				if (!param?.time || !param?.point) { tooltipVisible = false; return; }
				const val = areaSeries ? param.seriesData.get(areaSeries) as { value?: number } | undefined : undefined;
				if (val && val.value !== undefined) { tooltipVisible = true; tooltipX = param.point.x; tooltipY = param.point.y; tooltipValue = val.value; }
			});

			observer = new ResizeObserver(() => { chart?.applyOptions({ width: chartContainer.clientWidth }); });
			observer.observe(chartContainer);

			updateChartData(data);
		});

		return () => { destroyed = true; observer?.disconnect(); chart?.remove(); };
	});

	$effect(() => {
		if (data) updateChartData(data);
	});
</script>

{#if data && data.length > 1}
	<div class="relative">
		<div bind:this={chartContainer} class="w-full rounded-lg overflow-hidden" style="height: {height}px"></div>
		{#if tooltipVisible}
			<div class="absolute pointer-events-none z-50 bg-gray-900/95 text-white text-xs rounded-lg py-1.5 px-2.5 shadow-lg border border-gray-700/50"
				style="left: {Math.min(tooltipX + 10, (chartContainer?.clientWidth || 0) - 100)}px; top: {Math.max(tooltipY - 35, 5)}px;">
				<span class="font-mono font-semibold {tooltipValue >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(tooltipValue)}</span>
			</div>
		{/if}
	</div>
{/if}

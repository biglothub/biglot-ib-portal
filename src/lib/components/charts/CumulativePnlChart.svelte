<script lang="ts">
	import { onMount } from 'svelte';
	import { formatCurrency } from '$lib/utils';
	import type { IChartApi, ISeriesApi, MouseEventParams } from 'lightweight-charts';

	let {
		data = [],
		height = 220,
		loading = false
	}: {
		data?: Array<{ date: string; value: number }>;
		height?: number;
		loading?: boolean;
	} = $props();

	let chartContainer = $state<HTMLDivElement>(undefined!);
	let chart: IChartApi | null;
	let areaSeries: ISeriesApi<'Area'> | null;

	let currentTimeframe = $state('3M');
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipData = $state<any>(null);

	const timeframes = [
		{ label: '1M', days: 30 },
		{ label: '3M', days: 90 },
		{ label: '6M', days: 180 },
		{ label: '1Y', days: 365 },
		{ label: 'All', days: 9999 }
	];

	const selectedDays = $derived(timeframes.find(t => t.label === currentTimeframe)?.days || 90);

	const filteredData = $derived.by(() => {
		if (!data || data.length === 0) return [];
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - selectedDays);
		const cutoffStr = cutoff.toISOString().split('T')[0];
		return selectedDays >= 9999
			? data
			: data.filter(d => d.date >= cutoffStr);
	});

	function updateChartData() {
		if (!chart || !areaSeries) return;

		if (filteredData.length === 0) {
			areaSeries.setData([]);
			tooltipVisible = false;
			return;
		}

		const chartData = filteredData.map(d => ({
			time: d.date as any,
			value: d.value
		}));

		areaSeries.setData(chartData);
		chart.timeScale().fitContent();

		const lastVal = chartData[chartData.length - 1]?.value ?? 0;
		if (lastVal < 0) {
			areaSeries.applyOptions({
				lineColor: '#ef4444',
				topColor: 'rgba(239, 68, 68, 0.3)',
				bottomColor: 'rgba(239, 68, 68, 0.02)',
				crosshairMarkerBackgroundColor: '#ef4444'
			});
		} else {
			areaSeries.applyOptions({
				lineColor: '#C9A84C',
				topColor: 'rgba(201, 168, 76, 0.3)',
				bottomColor: 'rgba(201, 168, 76, 0.02)',
				crosshairMarkerBackgroundColor: '#C9A84C'
			});
		}
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
					layout: {
						background: { type: ColorType.Solid, color: 'transparent' },
						textColor: '#9CA3AF',
						fontFamily: "'Inter', sans-serif"
					},
					grid: {
						vertLines: { color: 'rgba(55, 65, 81, 0.3)', style: LineStyle.Dotted },
						horzLines: { color: 'rgba(55, 65, 81, 0.3)', style: LineStyle.Dotted }
					},
					width: chartContainer.clientWidth,
					height,
					rightPriceScale: {
						borderColor: 'rgba(55, 65, 81, 0.5)',
						scaleMargins: { top: 0.1, bottom: 0.1 }
					},
					timeScale: {
						borderColor: 'rgba(55, 65, 81, 0.5)',
						timeVisible: false,
						rightOffset: 3
					},
					crosshair: {
						mode: 1,
						vertLine: { color: 'rgba(201, 168, 76, 0.5)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1F2937' },
						horzLine: { color: 'rgba(201, 168, 76, 0.5)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1F2937' }
					},
					handleScroll: { mouseWheel: true, pressedMouseMove: true },
					handleScale: { mouseWheel: true, pinch: true }
				});

				areaSeries = chart.addAreaSeries({
					lineColor: '#C9A84C',
					topColor: 'rgba(201, 168, 76, 0.3)',
					bottomColor: 'rgba(201, 168, 76, 0.02)',
					lineWidth: 2,
					priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
					crosshairMarkerVisible: true,
					crosshairMarkerRadius: 4,
					crosshairMarkerBackgroundColor: '#C9A84C'
				});

				chart.subscribeCrosshairMove((param: MouseEventParams) => {
					if (!param || !param.time || !param.point) {
						tooltipVisible = false;
						return;
					}
					const val = areaSeries ? param.seriesData.get(areaSeries) as { value?: number } | undefined : undefined;
					if (val && val.value !== undefined) {
						tooltipVisible = true;
						tooltipX = param.point.x;
						tooltipY = param.point.y;
						tooltipData = {
							date: param.time,
							value: val.value
						};
					}
				});

				resizeObserver = new ResizeObserver(() => {
					chart?.applyOptions({ width: chartContainer.clientWidth });
				});
				resizeObserver.observe(chartContainer);

				updateChartData();
			});
		}, { threshold: 0.05 });

		intersectionObserver.observe(chartContainer);

		return () => {
			destroyed = true;
			intersectionObserver.disconnect();
			resizeObserver?.disconnect();
			chart?.remove();
			chart = null;
		};
	});

	$effect(() => {
		if (data || currentTimeframe) {
			updateChartData();
		}
	});
</script>

<div class="w-full" aria-busy={loading} aria-label="กำไร/ขาดทุนสะสม">
	{#if loading}
		<div class="animate-pulse">
			<div class="flex items-center justify-between mb-4">
				<div class="h-5 w-36 bg-dark-surface rounded"></div>
				<div class="h-7 w-40 bg-dark-surface rounded-lg"></div>
			</div>
			<div class="bg-dark-surface rounded-lg overflow-hidden relative" style:height="{height}px">
				<svg class="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
					<polyline
						points="0,80 15,70 30,60 45,50 55,40 70,30 85,20 100,15"
						fill="none"
						stroke="rgba(201,168,76,0.15)"
						stroke-width="2"
					/>
					<polyline
						points="0,80 15,70 30,60 45,50 55,40 70,30 85,20 100,15 100,100 0,100"
						fill="rgba(201,168,76,0.06)"
						stroke="none"
					/>
				</svg>
			</div>
		</div>
	{:else}
	<div class="flex items-center justify-between mb-4">
		<h3 class="text-lg font-semibold text-white">กำไร/ขาดทุนสะสม</h3>
		<div class="flex gap-1 bg-dark-bg/50 rounded-lg p-1">
			{#each timeframes as tf}
				<button
					class="px-3 py-1 text-xs font-medium rounded-md transition-all duration-200
						{currentTimeframe === tf.label
						? 'bg-dark-surface text-brand-primary shadow-sm'
						: 'text-gray-400 hover:text-gray-300'}"
					onclick={() => { currentTimeframe = tf.label; }}
				>
					{tf.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="relative">
		<div
			bind:this={chartContainer}
			class="w-full rounded-lg overflow-hidden"
			style="height: {height}px"
		></div>

		{#if tooltipVisible && tooltipData}
			<div
				class="absolute pointer-events-none z-50 bg-gray-900/95 text-white text-xs rounded-xl py-3 px-4 shadow-xl backdrop-blur-sm border border-gray-700/50 min-w-[150px]"
				style="left: {Math.min(tooltipX + 15, (chartContainer?.clientWidth || 0) - 170)}px; top: {Math.max(tooltipY - 50, 10)}px;"
			>
				<div class="text-gray-400 text-[10px] uppercase tracking-wide mb-2">{tooltipData.date}</div>
				<div class="flex items-center justify-between">
					<span class="text-gray-300">กำไร/ขาดทุนสะสม</span>
					<span class="font-mono font-semibold {tooltipData.value >= 0 ? 'text-green-400' : 'text-red-400'}">
						{formatCurrency(tooltipData.value)}
					</span>
				</div>
			</div>
		{/if}

		{#if !data || data.length === 0}
			<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
				ยังไม่มีข้อมูล Cumulative P&L
			</div>
		{:else if filteredData.length === 0}
			<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
				ไม่พบข้อมูลสำหรับช่วง {currentTimeframe}
			</div>
		{/if}
	</div>
	{/if}
</div>

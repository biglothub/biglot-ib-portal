<script lang="ts">
	import { onMount } from 'svelte';
	import { formatCurrency } from '$lib/utils';

	let {
		data = [],
		height = 220
	}: {
		data?: Array<{ date: string; value: number }>;
		height?: number;
	} = $props();

	let chartContainer = $state<HTMLDivElement>(undefined!);
	let chart: any;
	let areaSeries: any;

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

	const filteredData = $derived((() => {
		if (!data || data.length === 0) return [];
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - selectedDays);
		const cutoffStr = cutoff.toISOString().split('T')[0];
		return selectedDays >= 9999
			? data
			: data.filter(d => d.date >= cutoffStr);
	})());

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
	}

	onMount(() => {
		let observer: ResizeObserver | undefined;
		let destroyed = false;

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

			chart.subscribeCrosshairMove((param: any) => {
				if (!param || !param.time || !param.point) {
					tooltipVisible = false;
					return;
				}
				const val = param.seriesData.get(areaSeries);
				if (val) {
					tooltipVisible = true;
					tooltipX = param.point.x;
					tooltipY = param.point.y;
					tooltipData = {
						date: param.time,
						value: val.value
					};
				}
			});

			observer = new ResizeObserver(() => {
				chart?.applyOptions({ width: chartContainer.clientWidth });
			});
			observer.observe(chartContainer);

			updateChartData();
		});

		return () => {
			destroyed = true;
			observer?.disconnect();
			chart?.remove();
			chart = undefined;
		};
	});

	$effect(() => {
		if (data || currentTimeframe) {
			updateChartData();
		}
	});
</script>

<div class="w-full">
	<div class="flex items-center justify-between mb-4">
		<h3 class="text-lg font-semibold text-white">Cumulative P&L</h3>
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
					<span class="text-gray-300">Cumulative P&L</span>
					<span class="font-mono font-semibold {tooltipData.value >= 0 ? 'text-green-400' : 'text-red-400'}">
						{formatCurrency(tooltipData.value)}
					</span>
				</div>
			</div>
		{/if}

		{#if !data || data.length === 0}
			<div class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
				ยังไม่มีข้อมูล Cumulative P&L
			</div>
		{:else if filteredData.length === 0}
			<div class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
				ไม่พบข้อมูลสำหรับช่วง {currentTimeframe}
			</div>
		{/if}
	</div>
</div>

<script lang="ts">
	import { onMount } from 'svelte';

	let {
		data,
		height = 300
	}: {
		data: { time: string | number; value: number }[];
		height?: number;
	} = $props();

	let container: HTMLDivElement;
	let chart: import('lightweight-charts').IChartApi | undefined;
	let areaSeries: import('lightweight-charts').ISeriesApi<'Area'> | undefined;

	onMount(() => {
		let observer: ResizeObserver | undefined;
		let destroyed = false;

		import('lightweight-charts').then(({ createChart, ColorType }) => {
			if (destroyed) return;

			chart = createChart(container, {
				width: container.clientWidth,
				height,
				layout: {
					background: { type: ColorType.Solid, color: 'transparent' },
					textColor: '#9ca3af',
					fontFamily: 'Inter, sans-serif',
					fontSize: 11,
				},
				grid: {
					vertLines: { color: '#262626' },
					horzLines: { color: '#262626' },
				},
				rightPriceScale: {
					borderColor: '#262626',
				},
				timeScale: {
					borderColor: '#262626',
					timeVisible: true,
					secondsVisible: false,
				},
				crosshair: {
					horzLine: { color: '#404040', labelBackgroundColor: '#262626' },
					vertLine: { color: '#404040', labelBackgroundColor: '#262626' },
				},
			});

			areaSeries = chart.addAreaSeries({
				topColor: 'rgba(37, 99, 235, 0.4)',
				bottomColor: 'rgba(37, 99, 235, 0.0)',
				lineColor: '#2563eb',
				lineWidth: 2,
			});

			areaSeries.setData(data as any);
			chart.timeScale().fitContent();

			observer = new ResizeObserver(() => {
				chart?.applyOptions({ width: container.clientWidth });
			});
			observer.observe(container);
		});

		return () => {
			destroyed = true;
			observer?.disconnect();
			chart?.remove();
			chart = undefined;
			areaSeries = undefined;
		};
	});

	$effect(() => {
		if (!chart || !areaSeries) return;
		chart.applyOptions({ height });
		areaSeries.setData(data as any);
		chart.timeScale().fitContent();
	});
</script>

<div bind:this={container} class="w-full"></div>
